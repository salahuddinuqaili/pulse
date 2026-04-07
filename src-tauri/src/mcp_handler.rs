//! MCP (Model Context Protocol) request handler.
//!
//! Implements a minimal subset of the JSON-RPC 2.0 MCP protocol over HTTP +
//! Server-Sent Events. The server is intentionally feature-light: it exposes
//! GPU state as read-only resources for AI clients. There is no auth — the
//! server only ever binds to 127.0.0.1.

use std::collections::HashMap;
use std::convert::Infallible;
use std::net::{IpAddr, SocketAddr};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use axum::Json;
use axum::Router;
use axum::extract::{ConnectInfo, State};
use axum::http::StatusCode;
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use futures_util::Stream;
use futures_util::stream;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tracing::debug;

use crate::state::AppState;
use crate::types::GpuSnapshot;

/// JSON-RPC error codes per the spec.
const PARSE_ERROR: i32 = -32700;
const INVALID_REQUEST: i32 = -32600;
const METHOD_NOT_FOUND: i32 = -32601;
const INVALID_PARAMS: i32 = -32602;
const INTERNAL_ERROR: i32 = -32603;
/// Application-specific error code for unknown resource URIs.
const RESOURCE_NOT_FOUND: i32 = -32000;

/// Maximum requests permitted per client per second.
const RATE_LIMIT_PER_SECOND: u32 = 100;

#[derive(Clone)]
pub struct McpState {
    pub app_state: Arc<AppState>,
    rate_limiter: Arc<Mutex<HashMap<IpAddr, RateBucket>>>,
}

impl McpState {
    pub fn new(app_state: Arc<AppState>) -> Self {
        Self {
            app_state,
            rate_limiter: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Returns true if the request is within the per-second budget.
    fn check_rate_limit(&self, ip: IpAddr) -> bool {
        let mut buckets = self.rate_limiter.lock().unwrap();
        let now = Instant::now();
        let bucket = buckets.entry(ip).or_insert(RateBucket {
            window_start: now,
            count: 0,
        });
        if now.duration_since(bucket.window_start) >= Duration::from_secs(1) {
            bucket.window_start = now;
            bucket.count = 0;
        }
        bucket.count += 1;
        bucket.count <= RATE_LIMIT_PER_SECOND
    }
}

struct RateBucket {
    window_start: Instant,
    count: u32,
}

/// Build the axum router for the MCP server.
pub fn router(app_state: Arc<AppState>) -> Router {
    let state = McpState::new(app_state);
    Router::new()
        .route("/message", post(handle_message))
        .route("/sse", get(handle_sse))
        .route("/", get(handle_root))
        .with_state(state)
}

#[derive(Debug, Deserialize)]
struct JsonRpcRequest {
    #[serde(default)]
    jsonrpc: String,
    method: String,
    #[serde(default)]
    params: Value,
    id: Option<Value>,
}

#[derive(Debug, Serialize)]
struct JsonRpcResponse {
    jsonrpc: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<JsonRpcError>,
    id: Value,
}

#[derive(Debug, Serialize)]
struct JsonRpcError {
    code: i32,
    message: String,
}

impl JsonRpcResponse {
    fn ok(id: Value, result: Value) -> Self {
        Self {
            jsonrpc: "2.0",
            result: Some(result),
            error: None,
            id,
        }
    }

    fn err(id: Value, code: i32, message: impl Into<String>) -> Self {
        Self {
            jsonrpc: "2.0",
            result: None,
            error: Some(JsonRpcError {
                code,
                message: message.into(),
            }),
            id,
        }
    }
}

async fn handle_root() -> impl IntoResponse {
    Json(json!({
        "name": "pulse-mcp",
        "protocol": "mcp",
        "version": "0.1.0",
        "transport": ["http", "sse"],
    }))
}

async fn handle_message(
    State(state): State<McpState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    body: String,
) -> Response {
    if !state.check_rate_limit(addr.ip()) {
        return (StatusCode::TOO_MANY_REQUESTS, "rate limit exceeded").into_response();
    }

    let request: JsonRpcRequest = match serde_json::from_str(&body) {
        Ok(r) => r,
        Err(e) => {
            debug!("MCP parse error: {e}");
            return Json(JsonRpcResponse::err(
                Value::Null,
                PARSE_ERROR,
                format!("Parse error: {e}"),
            ))
            .into_response();
        }
    };

    if request.jsonrpc != "2.0" {
        return Json(JsonRpcResponse::err(
            request.id.unwrap_or(Value::Null),
            INVALID_REQUEST,
            "jsonrpc field must be \"2.0\"",
        ))
        .into_response();
    }

    let id = request.id.clone().unwrap_or(Value::Null);
    let response = dispatch(&state, &request.method, &request.params, id);
    Json(response).into_response()
}

fn dispatch(state: &McpState, method: &str, params: &Value, id: Value) -> JsonRpcResponse {
    match method {
        "initialize" => JsonRpcResponse::ok(id, initialize_result()),
        "resources/list" => JsonRpcResponse::ok(id, resources_list_result()),
        "resources/read" => match read_resource(state, params) {
            Ok(value) => JsonRpcResponse::ok(id, value),
            Err((code, msg)) => JsonRpcResponse::err(id, code, msg),
        },
        _ => JsonRpcResponse::err(id, METHOD_NOT_FOUND, format!("Method not found: {method}")),
    }
}

fn initialize_result() -> Value {
    json!({
        "protocolVersion": "2024-11-05",
        "capabilities": {
            "resources": { "listChanged": false }
        },
        "serverInfo": {
            "name": "pulse-mcp",
            "version": env!("CARGO_PKG_VERSION")
        }
    })
}

fn resources_list_result() -> Value {
    json!({
        "resources": [
            {
                "uri": "gpu://status",
                "name": "GPU Status",
                "description": "Full GPU snapshot including utilization, VRAM, temperature, power, and clocks",
                "mimeType": "application/json"
            },
            {
                "uri": "gpu://vram/available",
                "name": "VRAM Available",
                "description": "Free, used, and total VRAM in MB plus utilization percentage",
                "mimeType": "application/json"
            },
            {
                "uri": "gpu://vram/processes",
                "name": "VRAM Per-Process",
                "description": "Per-process VRAM allocations with category classification",
                "mimeType": "application/json"
            },
            {
                "uri": "gpu://temperature",
                "name": "GPU Temperature",
                "description": "Current core temperature plus warning and critical thresholds",
                "mimeType": "application/json"
            },
            {
                "uri": "gpu://headroom",
                "name": "VRAM Headroom",
                "description": "Free VRAM with a contextual headroom level and guidance text",
                "mimeType": "application/json"
            }
        ]
    })
}

fn read_resource(state: &McpState, params: &Value) -> Result<Value, (i32, String)> {
    let uri = params
        .get("uri")
        .and_then(Value::as_str)
        .ok_or((INVALID_PARAMS, "missing 'uri' parameter".to_string()))?;

    let snapshot = state.app_state.get_snapshot();

    let payload: Value = match uri {
        "gpu://status" => serde_json::to_value(&snapshot)
            .map_err(|e| (INTERNAL_ERROR, format!("serialize: {e}")))?,
        "gpu://vram/available" => json!({
            "free_mb": snapshot.vram_free_mb,
            "used_mb": snapshot.vram_used_mb,
            "total_mb": snapshot.vram_total_mb,
            "utilization_pct": vram_utilization_pct(&snapshot),
        }),
        "gpu://vram/processes" => {
            let procs: Vec<Value> = snapshot
                .processes
                .iter()
                .map(|p| {
                    json!({
                        "pid": p.pid,
                        "name": p.name,
                        "vram_mb": p.vram_mb,
                        "category": format!("{:?}", p.category).to_lowercase(),
                    })
                })
                .collect();
            json!({ "processes": procs })
        }
        "gpu://temperature" => {
            let s = state.app_state.current_snapshot.lock().unwrap().clone();
            json!({
                "current_c": s.temperature_c,
                "hotspot_c": s.temperature_hotspot_c,
                "warning_threshold": 70,
                "critical_threshold": 85,
            })
        }
        "gpu://headroom" => {
            let (level, guidance) = headroom_for(snapshot.vram_free_mb);
            json!({
                "free_mb": snapshot.vram_free_mb,
                "level": level,
                "guidance_text": guidance,
            })
        }
        other => {
            return Err((
                RESOURCE_NOT_FOUND,
                format!("Unknown resource URI: {other}"),
            ));
        }
    };

    let text = serde_json::to_string(&payload)
        .map_err(|e| (INTERNAL_ERROR, format!("serialize: {e}")))?;

    Ok(json!({
        "contents": [{
            "uri": uri,
            "mimeType": "application/json",
            "text": text,
        }]
    }))
}

fn vram_utilization_pct(snapshot: &GpuSnapshot) -> f32 {
    if snapshot.vram_total_mb == 0 {
        return 0.0;
    }
    (snapshot.vram_used_mb as f32 / snapshot.vram_total_mb as f32) * 100.0
}

/// Mirrors the frontend constants.ts headroom thresholds + guidance text.
fn headroom_for(free_mb: u32) -> (&'static str, &'static str) {
    match free_mb {
        m if m >= 8192 => (
            "comfortable",
            "Comfortable headroom — room for a 14B Q4 model or a demanding game",
        ),
        m if m >= 4096 => (
            "moderate",
            "Moderate headroom — a 7B Q4 model or a mid-range game would fit",
        ),
        m if m >= 2048 => (
            "limited",
            "Limited — only small models (3B) or lightweight games",
        ),
        m if m >= 512 => (
            "tight",
            "Tight — additional workloads risk instability",
        ),
        _ => ("critical", "Critical — VRAM nearly exhausted"),
    }
}

async fn handle_sse(
    State(_state): State<McpState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    // Emit a single "connected" event up front; axum's KeepAlive layer handles
    // periodic comments to keep the connection open. We don't push state changes
    // over SSE yet — clients should poll resources/read for updates.
    let connected = stream::once(async {
        Ok::<_, Infallible>(Event::default().event("connected").data("ok"))
    });
    Sse::new(connected).keep_alive(KeepAlive::default())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_valid_jsonrpc() {
        let body = r#"{"jsonrpc":"2.0","id":1,"method":"initialize"}"#;
        let req: JsonRpcRequest = serde_json::from_str(body).unwrap();
        assert_eq!(req.method, "initialize");
        assert_eq!(req.jsonrpc, "2.0");
    }

    #[test]
    fn rate_limit_blocks_excess() {
        let app_state = Arc::new(AppState::new(false));
        let state = McpState::new(app_state);
        let ip: IpAddr = "127.0.0.1".parse().unwrap();
        for _ in 0..RATE_LIMIT_PER_SECOND {
            assert!(state.check_rate_limit(ip));
        }
        // Next request in same window should be blocked
        assert!(!state.check_rate_limit(ip));
    }

    #[test]
    fn headroom_thresholds_match_frontend() {
        assert_eq!(headroom_for(10_000).0, "comfortable");
        assert_eq!(headroom_for(5_000).0, "moderate");
        assert_eq!(headroom_for(3_000).0, "limited");
        assert_eq!(headroom_for(1_000).0, "tight");
        assert_eq!(headroom_for(100).0, "critical");
    }

    #[test]
    fn dispatch_unknown_method_returns_error() {
        let app_state = Arc::new(AppState::new(false));
        let state = McpState::new(app_state);
        let resp = dispatch(&state, "nonexistent", &Value::Null, json!(1));
        assert!(resp.error.is_some());
        assert_eq!(resp.error.unwrap().code, METHOD_NOT_FOUND);
    }

    #[test]
    fn dispatch_initialize_succeeds() {
        let app_state = Arc::new(AppState::new(false));
        let state = McpState::new(app_state);
        let resp = dispatch(&state, "initialize", &Value::Null, json!(1));
        assert!(resp.result.is_some());
    }

    #[test]
    fn dispatch_resources_list_returns_five() {
        let app_state = Arc::new(AppState::new(false));
        let state = McpState::new(app_state);
        let resp = dispatch(&state, "resources/list", &Value::Null, json!(1));
        let result = resp.result.unwrap();
        let resources = result.get("resources").and_then(Value::as_array).unwrap();
        assert_eq!(resources.len(), 5);
    }

    #[test]
    fn read_resource_unknown_uri_errors() {
        let app_state = Arc::new(AppState::new(false));
        let state = McpState::new(app_state);
        let params = json!({ "uri": "gpu://nonexistent" });
        let resp = dispatch(&state, "resources/read", &params, json!(1));
        let err = resp.error.unwrap();
        assert_eq!(err.code, RESOURCE_NOT_FOUND);
    }
}
