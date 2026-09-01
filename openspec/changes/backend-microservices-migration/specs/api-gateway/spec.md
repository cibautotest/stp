## ADDED Requirements

### Requirement: Gateway routes requests to backend services
The Spring Cloud Gateway SHALL route incoming HTTP requests to the appropriate backend services based on configured routes.

#### Scenario: Route to platform service
- **WHEN** a GET request is sent to `/api/platform/projects`
- **THEN** the Gateway SHALL forward the request to `http://platform-service:8081/api/platform/projects`

#### Scenario: Route to engine service
- **WHEN** a POST request is sent to `/api/engine/execute`
- **THEN** the Gateway SHALL forward the request to `http://engine-service:3001/api/engine/execute`

#### Scenario: Unknown route returns 404
- **WHEN** a request is sent to an undefined route
- **THEN** the Gateway SHALL return HTTP 404 with body `{"error": "Route not found"}`

### Requirement: Gateway validates incoming requests
The Gateway SHALL perform basic request validation before forwarding to backend services.

#### Scenario: Reject malformed JSON body
- **WHEN** a POST request with invalid JSON body is sent to any `/api/*` route
- **THEN** the Gateway SHALL return HTTP 400 with body `{"error": "Invalid JSON body"}`

#### Scenario: Forward valid requests
- **WHEN** a request with valid JSON body is sent to `/api/platform/cases`
- **THEN** the Gateway SHALL forward the request unchanged to the target service

### Requirement: Gateway provides health check endpoint
The Gateway SHALL expose a health check endpoint at `/actuator/health` that aggregates the health status of all backend services.

#### Scenario: Health check returns aggregated status
- **WHEN** a GET request is sent to `/actuator/health`
- **THEN** the response SHALL include status of platform-service and engine-service
- **AND** return HTTP 200 if at least one service is healthy
