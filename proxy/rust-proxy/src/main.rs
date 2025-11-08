use actix_web::{
    middleware, web, App, HttpRequest, HttpResponse, HttpServer, Result,
};
use actix_cors::Cors;
use chrono::Utc;
use log::{info, warn};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::sync::Arc;

const ALLOWED_HOSTS: &[&str] = &[
    "api.openrouter.ai",
    "api.anthropic.com",
    "api.perplexity.ai",
    "generativelanguage.googleapis.com",
    "api-inference.huggingface.co",
];

#[derive(Deserialize)]
struct ProxyRequest {
    url: String,
    method: Option<String>,
    headers: Option<HashMap<String, String>>,
    body: Option<serde_json::Value>,
    key: String,
}

#[derive(Deserialize)]
struct BatchRequest {
    requests: Vec<ProxyRequest>,
    key: String,
}

#[derive(Serialize)]
struct ProxyResponse {
    status: u16,
    #[serde(rename = "statusText")]
    status_text: String,
    data: serde_json::Value,
    duration: u128,
    headers: HashMap<String, String>,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    allowed_hosts: Option<Vec<String>>,
}

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    service: String,
    version: String,
    uptime: u64,
}

struct AppState {
    auth_key: String,
    start_time: std::time::Instant,
}

fn validate_host(url: &str) -> Result<bool, Box<dyn std::error::Error>> {
    let parsed = url::Url::parse(url)?;
    let host = parsed.host_str().ok_or("Invalid host")?;
    Ok(ALLOWED_HOSTS.contains(&host))
}

fn log_request(
    ip: &str,
    method: &str,
    url: &str,
    status: u16,
    error: Option<&str>,
) {
    let log_entry = serde_json::json!({
        "timestamp": Utc::now().to_rfc3339(),
        "ip": ip,
        "method": method,
        "url": url,
        "status": status,
        "error": error,
    });
    info!("{}", log_entry);
}

async fn health(data: web::Data<Arc<AppState>>) -> Result<HttpResponse> {
    let uptime = data.start_time.elapsed().as_secs();
    Ok(HttpResponse::Ok().json(HealthResponse {
        status: "ok".to_string(),
        service: "claude-proxy".to_string(),
        version: "1.0.0".to_string(),
        uptime,
    }))
}

async fn route(
    req: HttpRequest,
    body: web::Json<ProxyRequest>,
    data: web::Data<Arc<AppState>>,
) -> Result<HttpResponse> {
    let ip = req
        .connection_info()
        .peer_addr()
        .unwrap_or("unknown")
        .to_string();

    // Validate auth key
    if body.key != data.auth_key {
        warn!("Unauthorized request from {}", ip);
        log_request(&ip, "POST", &body.url, 403, Some("Unauthorized"));
        return Ok(HttpResponse::Forbidden().json(ErrorResponse {
            error: "Unauthorized".to_string(),
            message: None,
            allowed_hosts: None,
        }));
    }

    // Validate URL and host
    match validate_host(&body.url) {
        Ok(true) => {}
        Ok(false) => {
            log_request(&ip, "POST", &body.url, 403, Some("Blocked host"));
            return Ok(HttpResponse::Forbidden().json(ErrorResponse {
                error: "Blocked host".to_string(),
                message: None,
                allowed_hosts: Some(ALLOWED_HOSTS.iter().map(|s| s.to_string()).collect()),
            }));
        }
        Err(e) => {
            return Ok(HttpResponse::BadRequest().json(ErrorResponse {
                error: "Invalid URL".to_string(),
                message: Some(e.to_string()),
                allowed_hosts: None,
            }));
        }
    }

    // Build request
    let client = reqwest::Client::new();
    let method = body
        .method
        .as_ref()
        .map(|s| s.as_str())
        .unwrap_or("GET");

    let start_time = std::time::Instant::now();

    let mut request_builder = match method {
        "GET" => client.get(&body.url),
        "POST" => client.post(&body.url),
        "PUT" => client.put(&body.url),
        "PATCH" => client.patch(&body.url),
        "DELETE" => client.delete(&body.url),
        _ => {
            return Ok(HttpResponse::BadRequest().json(ErrorResponse {
                error: "Invalid HTTP method".to_string(),
                message: None,
                allowed_hosts: None,
            }))
        }
    };

    // Add headers
    if let Some(headers) = &body.headers {
        for (key, value) in headers {
            request_builder = request_builder.header(key, value);
        }
    }

    // Add body for POST/PUT/PATCH
    if let Some(body_data) = &body.body {
        if method == "POST" || method == "PUT" || method == "PATCH" {
            request_builder = request_builder.json(body_data);
        }
    }

    // Execute request
    match request_builder.send().await {
        Ok(response) => {
            let status = response.status().as_u16();
            let duration = start_time.elapsed().as_millis();

            // Extract headers
            let mut response_headers = HashMap::new();
            for (key, value) in response.headers() {
                if let Ok(value_str) = value.to_str() {
                    response_headers.insert(key.to_string(), value_str.to_string());
                }
            }

            // Get response body
            let body_text = response.text().await.unwrap_or_default();
            let data: serde_json::Value = serde_json::from_str(&body_text)
                .unwrap_or_else(|_| serde_json::Value::String(body_text));

            log_request(&ip, method, &body.url, status, None);

            Ok(HttpResponse::Ok().json(ProxyResponse {
                status,
                status_text: "OK".to_string(),
                data,
                duration,
                headers: response_headers,
            }))
        }
        Err(e) => {
            log_request(&ip, method, &body.url, 500, Some(&e.to_string()));
            Ok(HttpResponse::InternalServerError().json(ErrorResponse {
                error: "Proxy request failed".to_string(),
                message: Some(e.to_string()),
                allowed_hosts: None,
            }))
        }
    }
}

async fn batch(
    req: HttpRequest,
    body: web::Json<BatchRequest>,
    data: web::Data<Arc<AppState>>,
) -> Result<HttpResponse> {
    let ip = req
        .connection_info()
        .peer_addr()
        .unwrap_or("unknown")
        .to_string();

    if body.key != data.auth_key {
        return Ok(HttpResponse::Forbidden().json(ErrorResponse {
            error: "Unauthorized".to_string(),
            message: None,
            allowed_hosts: None,
        }));
    }

    if body.requests.len() > 10 {
        return Ok(HttpResponse::BadRequest().json(ErrorResponse {
            error: "Maximum 10 requests per batch".to_string(),
            message: None,
            allowed_hosts: None,
        }));
    }

    // Process all requests concurrently
    let results = futures::future::join_all(body.requests.iter().map(|request| async {
        // Create a mock HttpRequest for logging
        match validate_host(&request.url) {
            Ok(true) => {
                let client = reqwest::Client::new();
                match client.get(&request.url).send().await {
                    Ok(response) => {
                        let status = response.status().as_u16();
                        let data = response.json::<serde_json::Value>().await.ok();
                        log_request(&ip, "GET", &request.url, status, None);
                        Some(serde_json::json!({ "status": status, "data": data }))
                    }
                    Err(e) => {
                        log_request(&ip, "GET", &request.url, 500, Some(&e.to_string()));
                        Some(serde_json::json!({ "error": e.to_string() }))
                    }
                }
            }
            _ => Some(serde_json::json!({ "error": "Blocked host" })),
        }
    }))
    .await;

    Ok(HttpResponse::Ok().json(serde_json::json!({ "results": results })))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv::dotenv().ok();
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));

    let auth_key = env::var("CLAUDE_PROXY_KEY").unwrap_or_else(|_| {
        warn!("CLAUDE_PROXY_KEY not set, using default (INSECURE!)");
        "change-me-in-production".to_string()
    });

    let port = env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse::<u16>()
        .expect("Invalid PORT");

    let state = Arc::new(AppState {
        auth_key: auth_key.clone(),
        start_time: std::time::Instant::now(),
    });

    info!("🚀 Claude Code Proxy starting on port {}", port);
    info!("📡 Allowed hosts: {:?}", ALLOWED_HOSTS);
    info!("🔐 Auth key: {}...", &auth_key[..10.min(auth_key.len())]);

    HttpServer::new(move || {
        let cors = Cors::permissive();

        App::new()
            .app_data(web::Data::new(state.clone()))
            .wrap(middleware::Logger::default())
            .wrap(cors)
            .route("/health", web::get().to(health))
            .route("/route", web::post().to(route))
            .route("/batch", web::post().to(batch))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
