

## codebuddy 插件/套件与SKILL

### 需求分析： product-manager，在产品需求探索时使用

#### 技能
*   product-management-workflows
*   feature-spec
*   user-research-synthesis
*   metrics-tracking

#### 规则
*   product_management_rules

#### 前端设计：frontend-design

#### 技能
*   frontend-design

### 规范驱动开发(sdd)：openspec，在迭代开发较细致的需求时使用

#### 技能
*   openspec-propose
*   openspec-explore
*   openspec-archive-change
*   openspec-apply-change

### 功能开发：在功能开发过程中自动使用

#### 技能
*   element-plus-vue3
*   java-springboot
*   express
*   spring-cloud

## 全局 RULES

## 基础交互规则
1. **语言要求**：请始终使用中文回答
2. **代码注释**：为复杂逻辑和关键节点添加详细中文注释
3. **内容深度**：提供详细解释和示例，不仅给结论
4. **格式要求**：代码超过20行时考虑聚合，保持可读性
5. **开发环境**：我的系统为 Windows

## 编码风格偏好
- **命名规范**：优先使用驼峰命名法
- **代码简洁**：避免冗余代码，追求简洁优雅的实现
- **错误处理**：强制使用try-catch处理异步操作
- **性能考虑**：关注代码性能，避免明显的性能问题

## 📝 Spring Boot 代码实现规范规则 (Java Coding Rules)

### 1. 核心架构与分层约束 (Architecture)
*   **包扫描路径：** 基础包路径设定为 `com.cib.myapp`。所有代码必须在此路径下。
*   **分层职责：**
    *   **Controller:** 仅负责接收请求、校验入参（使用 DTO + JSR 380 注解）、返回响应。**禁止**在 Controller 中编写业务逻辑或 SQL。
    *   **Service:** 业务逻辑核心。必须定义为接口（如 `UserService`）和实现类（如 `UserServiceImpl`）。**禁止**在 Service 中直接操作 `HttpServletRequest` 或 `HttpSession`。
    *   **Dao/Mapper:** 数据访问层。若使用 MyBatis-Plus，Mapper 接口需继承 `BaseMapper<T>`。

### 2. 数据模型与传输对象 (Models & DTOs)
*   **Entity vs DTO：** Entity 仅用于 ORM 映射（对应数据库表）；DTO 用于 Controller 层出入参。**严禁**直接将 Entity 作为 API 返回值暴露给前端。
*   **Lombok 规范：**
    *   实体类 (`entity`)：使用 `@Data`、`@TableName` (MyBatis-Plus)。
    *   DTO/VO：使用 `@Data` 配合 `@Accessors(chain = true)` 或 `@Builder`。
    *   必须使用 `@NoArgsConstructor`。
*   **Validation 校验：**
    *   在 Controller 方法的入参 DTO 上必须使用 `@Valid` 或 `@Validated`。
    *   DTO 字段需添加约束注解（如 `@NotBlank`, `@Email`, `@Size(min=6, max=20)`）。

### 3. 数据库与 MyBatis-Plus 规范 (Data Layer)
*   **SQL 编写：**
    *   简单的 CRUD 使用 MyBatis-Plus 的 `LambdaQueryWrapper` 或 `BaseMapper` 方法。
    *   **禁止**在 Java 代码中拼接 SQL 字符串。
    *   复杂查询必须在 `resources/mapper/` 目录下编写 XML 文件。
*   **字段映射：** 数据库字段（下划线 `snake_case`）与 Java 实体（驼峰 `camelCase`）自动转换需开启（默认开启），特殊情况使用 `@TableField` 注解。
*   **主键策略：** 实体主键推荐使用 `@TableId(type = IdType.ASSIGN_ID)` (雪花算法) 或 `AUTO` (自增)，并在代码中显式声明。
*   **防全表扫描：** 查询时必须考虑分页（`Page` 对象）或限制条数，避免使用无条件的 `selectList`。

### 4. 安全与配置 (Security & Config)
*   **敏感信息：** 严禁硬编码密码、Token、IP 地址。必须存放在 `application.yml` 或通过环境变量注入。
*   **配置文件：** 使用 `application.yml`。不同环境（dev/test/prod）使用 `spring.profiles.active` 区分。
*   **Swagger/OpenAPI：** 集成 `springdoc-openapi`。在 Controller 和方法上使用 `@Tag` 和 `@Operation` 注解。生产环境（prod）需通过配置关闭 Swagger UI。

### 5. 测试规范 (Testing)
*   **单元测试：** 使用 JUnit 5 (`@Test`) 和 Mockito (`@Mock`, `@InjectMocks`)。
*   **Service 测试：** 测试 Service 层时，使用 `@ExtendWith(MockitoExtension.class)`，Mock 掉 Mapper/Repository，不依赖真实数据库。
*   **Controller 测试：** 使用 `@WebMvcTest` 切片测试，配合 `MockMvc` 验证 API 行为。

