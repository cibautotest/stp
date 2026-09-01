## ADDED Requirements

### Requirement: Report detail dialog basic info

The report detail dialog SHALL display basic information: report name, project name, execution status, duration, and creation time using `el-descriptions`.

#### Scenario: Display basic info
- **WHEN** user clicks "查看详情" on a report row
- **THEN** the dialog SHALL display report name, project name, status tag, duration (formatted as seconds), and creation time

### Requirement: Report detail target URL

The report detail dialog SHALL display the target URL as a clickable link.

#### Scenario: Display target URL
- **WHEN** the report has a non-empty `url` field
- **THEN** the dialog SHALL display the URL as a clickable `el-link` that opens in a new tab

#### Scenario: No target URL
- **WHEN** the report has an empty `url` field
- **THEN** the dialog SHALL display "-" for the URL field

### Requirement: Report detail NLP instruction

The report detail dialog SHALL display the NLP instruction content.

#### Scenario: Display NLP instruction
- **WHEN** the report has a non-empty `nlp` field
- **THEN** the dialog SHALL display the full NLP instruction text
- **AND** if the text exceeds 3 lines, it SHALL be collapsible (expand/collapse)

### Requirement: Report detail YAML flow

The report detail dialog SHALL display the YAML flow content in a code-style block.

#### Scenario: Display YAML flow
- **WHEN** the report has a non-empty `yamlFlow` field
- **THEN** the dialog SHALL display the YAML flow inside an `el-collapse` panel
- **AND** the content SHALL be rendered in monospace font with syntax highlighting style

### Requirement: Report detail execution result

The report detail dialog SHALL display the execution result as formatted JSON.

#### Scenario: Display execution result
- **WHEN** the report has a non-empty `result` field
- **THEN** the dialog SHALL parse the JSON string and display it in a formatted code block
- **AND** if JSON parsing fails, the raw string SHALL be displayed

#### Scenario: No execution result
- **WHEN** the report has an empty `result` field
- **THEN** the dialog SHALL display "无执行结果"

### Requirement: Report detail error message

The report detail dialog SHALL display the error message when the report status is FAILED.

#### Scenario: Display error for failed report
- **WHEN** the report status is "FAILED" and the `error` field is non-empty
- **THEN** the dialog SHALL display the error message in a red-highlighted block

#### Scenario: Hide error for successful report
- **WHEN** the report status is "SUCCESS"
- **THEN** the dialog SHALL NOT display the error section

### Requirement: Report detail execution logs

The report detail dialog SHALL display execution logs in a dark terminal-style block.

#### Scenario: Display execution logs
- **WHEN** the report has a non-empty `logs` field
- **THEN** the dialog SHALL display the logs in a dark-themed code block with monospace font
- **AND** the log block SHALL have a max height with vertical scrolling

#### Scenario: No execution logs
- **WHEN** the report has an empty `logs` field
- **THEN** the dialog SHALL display "暂无执行日志"
