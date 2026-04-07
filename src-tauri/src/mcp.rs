//! MCP server lifecycle manager.
//!
//! Owns the axum HTTP server. The server can be started and stopped
//! independently of app boot — toggled from Settings → External Integrations.

use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use tokio::sync::oneshot;
use tracing::{error, info, warn};

use crate::mcp_handler;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpStatus {
    pub running: bool,
    pub endpoint_url: String,
    pub port: u16,
}

pub struct McpServer {
    port: Mutex<u16>,
    shutdown_tx: Mutex<Option<oneshot::Sender<()>>>,
    running: Mutex<bool>,
}

impl McpServer {
    pub fn new(port: u16) -> Self {
        Self {
            port: Mutex::new(port),
            shutdown_tx: Mutex::new(None),
            running: Mutex::new(false),
        }
    }

    pub fn is_running(&self) -> bool {
        *self.running.lock().unwrap()
    }

    pub fn endpoint_url(&self) -> String {
        let port = *self.port.lock().unwrap();
        format!("http://127.0.0.1:{port}")
    }

    pub fn port(&self) -> u16 {
        *self.port.lock().unwrap()
    }

    pub fn status(&self) -> McpStatus {
        McpStatus {
            running: self.is_running(),
            endpoint_url: self.endpoint_url(),
            port: self.port(),
        }
    }

    /// Update the bound port. Only allowed while the server is stopped.
    pub fn set_port(&self, port: u16) -> Result<(), String> {
        if self.is_running() {
            return Err("Cannot change port while MCP server is running".to_string());
        }
        *self.port.lock().unwrap() = port;
        Ok(())
    }

    /// Start the MCP server bound to 127.0.0.1 on the configured port.
    /// Idempotent — returns Ok if already running.
    pub async fn start(&self, app_state: Arc<AppState>) -> Result<(), String> {
        if self.is_running() {
            return Ok(());
        }

        let port = self.port();
        let addr: SocketAddr = format!("127.0.0.1:{port}")
            .parse()
            .map_err(|e| format!("Invalid socket address: {e}"))?;

        let listener = tokio::net::TcpListener::bind(addr)
            .await
            .map_err(|e| format!("Failed to bind {addr}: {e}"))?;

        let (tx, rx) = oneshot::channel::<()>();
        *self.shutdown_tx.lock().unwrap() = Some(tx);
        *self.running.lock().unwrap() = true;

        let router = mcp_handler::router(app_state);

        info!("MCP server listening on {addr}");

        let running_flag = Arc::new(Mutex::new(true));
        let running_clone = running_flag.clone();

        tokio::spawn(async move {
            let server = axum::serve(
                listener,
                router.into_make_service_with_connect_info::<SocketAddr>(),
            )
            .with_graceful_shutdown(async move {
                let _ = rx.await;
                info!("MCP server received shutdown signal");
            });

            if let Err(e) = server.await {
                error!("MCP server error: {e}");
            }
            *running_clone.lock().unwrap() = false;
            info!("MCP server stopped");
        });

        Ok(())
    }

    /// Send the shutdown signal. Server task may take a moment to drain.
    pub fn stop(&self) {
        if let Some(tx) = self.shutdown_tx.lock().unwrap().take()
            && tx.send(()).is_err()
        {
            warn!("MCP shutdown signal: receiver already dropped");
        }
        *self.running.lock().unwrap() = false;
    }
}

impl Default for McpServer {
    fn default() -> Self {
        Self::new(9426)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn endpoint_url_uses_loopback() {
        let server = McpServer::new(9426);
        assert_eq!(server.endpoint_url(), "http://127.0.0.1:9426");
    }

    #[test]
    fn set_port_blocked_when_running() {
        let server = McpServer::new(9426);
        *server.running.lock().unwrap() = true;
        assert!(server.set_port(9999).is_err());
    }

    #[test]
    fn set_port_succeeds_when_stopped() {
        let server = McpServer::new(9426);
        assert!(server.set_port(9999).is_ok());
        assert_eq!(server.port(), 9999);
    }
}
