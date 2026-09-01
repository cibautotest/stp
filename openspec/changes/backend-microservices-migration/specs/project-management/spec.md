## ADDED Requirements

### Requirement: User can create a new project
The system SHALL allow users to create a new project with a unique name and description.

#### Scenario: Create project successfully
- **WHEN** a POST request is sent to `/api/platform/projects` with body `{"name": "E-Commerce", "description": "E-commerce testing project"}`
- **THEN** the system SHALL create a new project with auto-generated UUID
- **AND** return HTTP 201 with the created project object including `id`, `name`, `description`, `createdAt`

#### Scenario: Create project with duplicate name
- **WHEN** a POST request is sent with a project name that already exists
- **THEN** the system SHALL return HTTP 409 with body `{"error": "Project name already exists"}`

#### Scenario: Create project with missing name
- **WHEN** a POST request is sent without the `name` field
- **THEN** the system SHALL return HTTP 400 with body `{"error": "Project name is required"}`

### Requirement: User can list all projects
The system SHALL return a list of all projects in the system.

#### Scenario: List projects
- **WHEN** a GET request is sent to `/api/platform/projects`
- **THEN** the system SHALL return HTTP 200 with array of all projects
- **AND** each project SHALL include `id`, `name`, `description`, `createdAt`, `updatedAt`

#### Scenario: List projects when empty
- **WHEN** a GET request is sent and no projects exist
- **THEN** the system SHALL return HTTP 200 with empty array `[]`

### Requirement: User can get project details
The system SHALL return detailed information about a specific project.

#### Scenario: Get existing project
- **WHEN** a GET request is sent to `/api/platform/projects/{id}`
- **THEN** the system SHALL return HTTP 200 with the project object
- **AND** include associated case count

#### Scenario: Get non-existent project
- **WHEN** a GET request is sent with a non-existent project ID
- **THEN** the system SHALL return HTTP 404 with body `{"error": "Project not found"}`

### Requirement: User can update a project
The system SHALL allow updating a project's name and description.

#### Scenario: Update project successfully
- **WHEN** a PUT request is sent to `/api/platform/projects/{id}` with body `{"name": "New Name", "description": "Updated description"}`
- **THEN** the system SHALL update the project
- **AND** return HTTP 200 with the updated project object

#### Scenario: Update non-existent project
- **WHEN** a PUT request is sent with a non-existent project ID
- **THEN** the system SHALL return HTTP 404 with body `{"error": "Project not found"}`

### Requirement: User can delete a project
The system SHALL allow deleting a project. Deleting a project SHALL also delete all associated test cases.

#### Scenario: Delete project successfully
- **WHEN** a DELETE request is sent to `/api/platform/projects/{id}`
- **THEN** the system SHALL delete the project and all associated cases
- **AND** return HTTP 204 with empty body

#### Scenario: Delete non-existent project
- **WHEN** a DELETE request is sent with a non-existent project ID
- **THEN** the system SHALL return HTTP 404 with body `{"error": "Project not found"}`
