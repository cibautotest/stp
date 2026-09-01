## ADDED Requirements

### Requirement: Generated YAML script synchronizes target URL to editor form
When the system generates a YAML script from NLP instructions, it SHALL update the script editor's target URL field to reflect the URL contained in the generated YAML.

#### Scenario: NLP contains URL and form URL is empty
- **WHEN** user enters NLP "打开 https://www.taobao.com，搜索商品" with an empty form URL field
- **AND** clicks "生成脚本" button
- **THEN** the generated YAML SHALL contain `web:\n  url: https://www.taobao.com`
- **AND** the script editor's "目标 URL" field SHALL be updated to `https://www.taobao.com`

#### Scenario: Form has pre-filled URL but NLP has no URL
- **WHEN** user has manually set form URL to `https://www.example.com`
- **AND** enters NLP "在搜索框输入关键词" (no URL in NLP)
- **AND** clicks "生成脚本" button
- **THEN** the generated YAML SHALL contain `web:\n  url: https://www.example.com` (preserving form URL)
- **AND** the script editor's "目标 URL" field SHALL remain `https://www.example.com`

#### Scenario: Both NLP and form contain different URLs
- **WHEN** user has manually set form URL to `https://www.example.com`
- **AND** enters NLP "打开 https://www.taobao.com，搜索商品"
- **AND** clicks "生成脚本" button
- **THEN** the generated YAML SHALL contain `web:\n  url: https://www.example.com` (form URL takes priority)
- **AND** the script editor's "目标 URL" field SHALL remain `https://www.example.com`
