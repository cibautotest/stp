## 1. Database

- [x] 1.1 Create `execution_record` table in `init.sql` with fields: id (BIGINT, PK), case_id (VARCHAR), execution_id (VARCHAR, unique), status (VARCHAR), created_at (DATETIME), updated_at (DATETIME)

## 2. Backend - Entity & Mapper

- [x] 2.1 Create `ExecutionRecord.java` entity class with fields: id, caseId, executionId, status, createdAt, updatedAt
- [x] 2.2 Create `ExecutionRecordMapper.java` MyBatis mapper interface
- [x] 2.3 Create `ExecutionRecordMapper.xml` with CRUD SQL and query for running records

## 3. Backend - ExecuteStatusClient

- [x] 3.1 Create `ExecuteStatusClient.java` Feign client interface for `GET /execute/:id/status`
- [x] 2.2 Create `ExecuteStatusClientFallback.java` fallback implementation

## 4. Backend - ExecutionStatusSyncService

- [x] 4.1 Enable scheduling in `PlatformApplication.java` or config class (`@EnableScheduling`)
- [x] 4.2 Create `ExecutionStatusSyncService.java` with `@Scheduled(fixedRate = 10000)`
- [x] 4.3 Implement poll logic: query RUNNING records, call execute-service, update status
- [x] 4.4 Implement status mapping logic (completed→SUCCESS, failed→FAILED, etc.)
- [x] 4.5 Implement Report creation on completion/failure
- [x] 4.6 Update `TestCase.htmlReportPath` with report URL

## 5. Backend - Execution Services Integration

- [x] 5.1 Modify `ExecutionService.java` to create `ExecutionRecord` after successful `asyncExecute` call
- [x] 5.2 Modify `CaseExecutionService.java` to create `ExecutionRecord` after successful `asyncExecute` call
- [x] 5.3 Modify `CreateAndExecuteService.java` to create `ExecutionRecord` after successful `asyncExecute` call

## 6. Frontend - Case List Status Display

- [x] 6.1 Update `frontend/src/types/index.ts` to add `status` field with enum values
- [x] 6.2 Update `frontend/src/api/cases.ts` to include status field in API responses
- [x] 6.3 Update `frontend/src/views/cases/index.vue` to display status badge with color coding
- [x] 6.4 Add "Latest Report" button column that links to `htmlReportPath`
- [x] 6.5 Hide report button when `htmlReportPath` is null or status is PENDING

## 7. Testing

- [ ] 7.1 Test: Submit execution and verify `ExecutionRecord` is created
- [ ] 7.2 Test: Verify status sync service polls and updates status after execution completes
- [ ] 7.3 Test: Verify Report record is created on execution completion
- [ ] 7.4 Test: Verify frontend displays correct status and report button
