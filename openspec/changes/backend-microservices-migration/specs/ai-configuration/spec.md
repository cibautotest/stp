## ADDED Requirements

### Requirement: User can get AI configuration
The system SHALL allow users to retrieve the current AI configuration for Midscene.

#### Scenario: Get AI configuration
- **WHEN** a GET request is sent to `/api/platform/config`
- **THEN** the system SHALL return HTTP 200 with the configuration object containing `baseUrl`, `apiKey`, `modelName`, `modelFamily`, `browserHeadless`
- **AND** the `apiKey` SHALL be masked in the response (show only last 4 characters)

### Requirement: User can update AI configuration
The system SHALL allow updating the AI configuration for Midscene.

#### Scenario: Update AI configuration successfully
- **WHEN** a PUT request is sent to `/api/platform/config` with valid configuration
- **THEN** the system SHALL save the configuration
- **AND** return HTTP 200 with body `{"success": true}`

#### Scenario: Update configuration with valid URL
- **WHEN** a PUT request is sent with `baseUrl` set to an invalid URL
- **THEN** the system SHALL return HTTP 400 with body `{"error": "Invalid baseUrl format"}`

#### Scenario: Update configuration with valid model name
- **WHEN** a PUT request is sent with `modelName` set to an empty string
- **THEN** the system SHALL return HTTP 400 with body `{"error": "Model name is required"}`

### Requirement: AI configuration applies to test execution
The AI configuration SHALL be passed to the execution engine when running tests.

#### Scenario: Configuration is used in execution
- **WHEN** a test case is executed
- **THEN** the execution engine SHALL use the configured `baseUrl`, `apiKey`, `modelName`, `modelFamily`
- **AND** apply the configured `browserHeadless` setting
