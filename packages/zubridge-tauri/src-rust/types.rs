use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Action {
    #[serde(rename = "type")]
    pub action_type: String,
    pub payload: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct State {
    pub value: serde_json::Value,
}
