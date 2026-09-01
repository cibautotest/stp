## ADDED Requirements

### Requirement: System generates YAML script from NLP
The system SHALL automatically generate Midscene-compatible YAML task flow from natural language instructions.

#### Scenario: Generate YAML from NLP
- **WHEN** a test case is created with NLP instruction containing "在搜索框输入 'iPhone' 并点击搜索按钮"
- **THEN** the system SHALL generate a YAML script with:
  ```yaml
  tasks:
    - name: search
      flow:
        - ai: 在搜索框输入 'iPhone' 并点击搜索按钮
        - sleep: 3000
  ```

#### Scenario: Generate YAML with URL extraction
- **WHEN** a test case NLP contains a URL "访问 https://example.com"
- **THEN** the system SHALL extract the URL and generate YAML with:
  ```yaml
  web:
    url: https://example.com
  tasks:
    - name: main
      flow:
        - ai: <extracted task>
  ```

### Requirement: User can provide custom YAML script
The system SHALL allow users to provide custom YAML scripts instead of auto-generating from NLP.

#### Scenario: Use custom YAML
- **WHEN** a POST request is sent to `/api/platform/cases/{id}` with custom `yamlFlow`
- **THEN** the system SHALL use the provided YAML instead of auto-generating
- **AND** store the custom YAML in the database

### Requirement: System validates YAML script format
The system SHALL validate YAML scripts before saving or executing.

#### Scenario: Valid YAML format
- **WHEN** a YAML script with valid Midscene format is submitted
- **THEN** the system SHALL accept and store the script

#### Scenario: Invalid YAML format
- **WHEN** a YAML script with syntax errors is submitted
- **THEN** the system SHALL return HTTP 400 with body `{"error": "Invalid YAML syntax", "details": "<parse error>"}`

#### Scenario: Missing required fields in YAML
- **WHEN** a YAML script without `tasks` array is submitted
- **THEN** the system SHALL return HTTP 400 with body `{"error": "YAML must contain 'tasks' array"}`

### Requirement: YAML script generation supports Midscene task types
The system SHALL support generating YAML for common Midscene task types.

#### Scenario: Generate AI task
- **WHEN** NLP contains action verbs like "点击", "输入", "滚动"
- **THEN** the system SHALL generate YAML with `ai:` task type

#### Scenario: Generate aiQuery task
- **WHEN** NLP contains query verbs like "获取", "查询", "提取"
- **THEN** the system SHALL generate YAML with `aiQuery:` task type

#### Scenario: Generate aiString task
- **WHEN** NLP contains question like "是什么", "有多少"
- **THEN** the system SHALL generate YAML with `aiString:` task type
