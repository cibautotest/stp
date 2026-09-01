## ADDED Requirements

### Requirement: Paginated report query with project filter

The backend `GET /api/platform/reports` endpoint SHALL support optional `projectId` filter parameter alongside existing pagination.

#### Scenario: Query reports with project filter
- **WHEN** a request is sent to `GET /api/platform/reports?projectId=xxx&page=1&size=10`
- **THEN** the backend SHALL return paginated reports filtered by the specified `projectId`
- **AND** the response SHALL include `total`, `page`, `size`, and `items` fields

#### Scenario: Query reports without project filter
- **WHEN** a request is sent to `GET /api/platform/reports?page=1&size=10` without `projectId`
- **THEN** the backend SHALL return all reports in paginated form

### Requirement: Report query JOIN projects table

The backend report query SHALL JOIN `projects` table to include project name in the response. Reports have their own `name` and `project_id` fields, no need to JOIN `test_cases`.

#### Scenario: Report list includes joined project name
- **WHEN** the backend queries the report list
- **THEN** each report item SHALL include `projectName` (from `projects.name`)
- **AND** the JOIN SHALL be a LEFT JOIN to handle cases where the project has been deleted
- **AND** each report item SHALL include `name` (from `reports.name`) as the report's display name

### Requirement: Delete report endpoint

The backend SHALL provide a `DELETE /api/platform/reports/{id}` endpoint to delete a report by its ID.

#### Scenario: Delete an existing report
- **WHEN** a request is sent to `DELETE /api/platform/reports/{id}` and the report exists
- **THEN** the backend SHALL delete the report from the `reports` table
- **AND** the response SHALL return HTTP 200 with `{ "success": true }`

#### Scenario: Delete a non-existing report
- **WHEN** a request is sent to `DELETE /api/platform/reports/{id}` and the report does not exist
- **THEN** the backend SHALL return HTTP 404 with an error message

### Requirement: Reports table new fields

The `reports` table SHALL be extended with `name` and `project_id` fields to support independent report naming and project association.

#### Scenario: ALTER TABLE add name and project_id
- **WHEN** the database migration is applied
- **THEN** the `reports` table SHALL have a new `name VARCHAR(255)` column with DEFAULT ''
- **AND** the `reports` table SHALL have a new `project_id VARCHAR(64)` column with DEFAULT NULL
- **AND** an index `idx_project_id` SHALL be created on `project_id`

#### Scenario: Fill name and project_id for existing records
- **WHEN** the migration script runs on existing data
- **THEN** for each existing report, `name` SHALL be set to the corresponding `test_cases.name` (via `case_id`)
- **AND** `project_id` SHALL be set to the corresponding `test_cases.project_id` (via `case_id`)

### Requirement: Auto-fill name and project_id on report creation

When a report is created (via execution status sync), the `name` and `project_id` fields SHALL be automatically populated.

#### Scenario: Sync creates a new report
- **WHEN** `ExecutionStatusSyncService` creates a new `Report` record
- **THEN** the `name` field SHALL be set to the test case's name (fetched by `caseId`)
- **AND** the `project_id` field SHALL be set to the test case's `project_id`
