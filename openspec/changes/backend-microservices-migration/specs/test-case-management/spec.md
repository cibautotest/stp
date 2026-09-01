## ADDED Requirements

### Requirement: User can create a test case
The system SHALL allow users to create a new test case associated with a project.

#### Scenario: Create test case successfully
- **WHEN** a POST request is sent to `/api/platform/cases` with body containing `nlp`, `projectId`
- **THEN** the system SHALL create a new test case with auto-generated UUID
- **AND** assign status `PENDING`
- **AND** return HTTP 201 with the created case object

#### Scenario: Create test case with invalid project
- **WHEN** a POST request is sent with a non-existent `projectId`
- **THEN** the system SHALL return HTTP 400 with body `{"error": "Project not found"}`

#### Scenario: Create test case with missing NLP
- **WHEN** a POST request is sent without `nlp` field
- **THEN** the system SHALL return HTTP 400 with body `{"error": "NLP instruction is required"}`

### Requirement: User can list test cases
The system SHALL return a list of test cases, optionally filtered by project.

#### Scenario: List all test cases
- **WHEN** a GET request is sent to `/api/platform/cases`
- **THEN** the system SHALL return HTTP 200 with array of all test cases

#### Scenario: List test cases by project
- **WHEN** a GET request is sent to `/api/platform/cases?projectId={projectId}`
- **THEN** the system SHALL return only test cases belonging to the specified project

### Requirement: User can get test case details
The system SHALL return detailed information about a specific test case.

#### Scenario: Get existing test case
- **WHEN** a GET request is sent to `/api/platform/cases/{id}`
- **THEN** the system SHALL return HTTP 200 with the test case object including `yamlFlow`, `script`

#### Scenario: Get non-existent test case
- **WHEN** a GET request is sent with a non-existent case ID
- **THEN** the system SHALL return HTTP 404 with body `{"error": "Test case not found"}`

### Requirement: User can update a test case
The system SHALL allow updating a test case's name, NLP instruction, and YAML flow.

#### Scenario: Update test case successfully
- **WHEN** a PUT request is sent to `/api/platform/cases/{id}` with updated fields
- **THEN** the system SHALL update the test case
- **AND** return HTTP 200 with the updated case object

#### Scenario: Update test case name
- **WHEN** a PUT request is sent with `{ "name": "New Name" }`
- **THEN** the system SHALL update the test case name
- **AND** return HTTP 200 with the updated case object

### Requirement: User can delete a test case
The system SHALL allow deleting a test case.

#### Scenario: Delete test case successfully
- **WHEN** a DELETE request is sent to `/api/platform/cases/{id}`
- **THEN** the system SHALL delete the test case and its associated reports
- **AND** return HTTP 204

### Requirement: User can batch delete test cases
The system SHALL allow deleting multiple test cases in a single request.

#### Scenario: Batch delete test cases
- **WHEN** a POST request is sent to `/api/platform/cases/batch-delete` with body `{"ids": ["id1", "id2", "id3"]}`
- **THEN** the system SHALL delete all specified test cases
- **AND** return HTTP 200 with body `{"deleted": 3}`

### Requirement: Test case has status lifecycle
The system SHALL track the status of a test case through its lifecycle.

#### Scenario: Test case status transitions
- **WHEN** a test case is created
- **THEN** its initial status SHALL be `PENDING`
- **WHEN** execution starts
- **THEN** its status SHALL transition to `RUNNING`
- **WHEN** execution completes successfully
- **THEN** its status SHALL be `SUCCESS`
- **WHEN** execution fails
- **THEN** its status SHALL be `FAILED`
