---
### 技能名称：java-springboot  
**描述**：获取使用 Spring Boot 开发应用程序的最佳实践指南。
---

# Spring Boot 最佳实践

您的目标是帮助我遵循既定最佳实践，编写高质量的 Spring Boot 应用程序。

## 一、项目搭建与结构

- **构建工具**：使用 Maven（`pom.xml`）进行依赖管理。  
- **Starter 依赖**：使用 Spring Boot Starter（如 `spring-boot-starter-web`）简化依赖配置。  
- **包结构设计**：按功能/领域组织代码（例如 `com.example.app.order`、`com.example.app.user`），而非按层级（如 `com.example.app.controller`、`com.example.app.service`）。
- **版本**：基于SPRINGBOOT 2.7.18
- **全局异常处理**：
```java
@ControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleUserNotFound(UserNotFoundException ex) {
        ErrorResponse error = new ErrorResponse(
            HttpStatus.NOT_FOUND.value(),
            ex.getMessage()
        );
        return new ResponseEntity<>(error, HttpStatus.NOT_FOUND);
    }
}
```
- **项目结构**：
```
com.xtest.myapp/
├── controller/     # 控制器
├── service/        # 服务层
├── dao/            # 数据访问层
├── entity/         # 实体类
├── dto/            # 数据传输对象
├── config/         # 配置类
├── aspect/         # 面向切面的组件
├── utils/          # 工具类
├── enums/          # 枚举
└── exception/      # 异常类

```

## 二、依赖注入与组件

- **构造器注入**：始终对必需依赖使用构造器注入。这种方式更利于组件测试，并显式声明依赖关系。  
- **不可变性**：将依赖字段声明为 `private final`。  
- **组件注解**：正确使用 `@Component`、`@Service`、`@Repository` 以及 `@Controller`/`@RestController` 注解来定义 Bean。

## 三、配置管理

- **外部化配置**：使用 `application.yml`（或 `application.properties`）管理配置。YAML 格式因其可读性和层级结构通常更受推荐。  
- **类型安全属性**：通过 `@ConfigurationProperties` 将配置绑定到强类型的 Java 对象。  
- **Profile 配置**：使用 Spring Profile（如 `application-dev.yml`、`application-prod.yml`）管理不同环境的配置。  
- **密钥管理**：禁止硬编码敏感信息。使用环境变量或专用密钥管理工具（如 HashiCorp Vault、AWS Secrets Manager）。

## 四、Web 层（控制器）

- **RESTful API 设计**：设计清晰、一致的 RESTful 接口。  
- **DTO 模式**：使用 DTO（数据传输对象）在 API 层暴露和接收数据，避免直接将 JPA 实体暴露给客户端。  
- **请求验证**：在 DTO 上使用 Java Bean Validation（JSR 380）注解（如 `@Valid`、`@NotNull`、`@Size`）验证请求负载。  
- **全局异常处理**：通过 `@ControllerAdvice` 和 `@ExceptionHandler` 实现全局异常处理器，提供一致的错误响应。

## 五、服务层

- **业务逻辑封装**：将所有业务逻辑集中在 `@Service` 类中。  
- **无状态性**：服务类应设计为无状态的。  
- **事务管理**：在服务方法上使用 `@Transactional` 注解以声明式管理数据库事务，且仅在必要的最小粒度上应用。

## 六、数据层（仓库）

- **MyBatis Mapper 接口**：通过定义 Mapper 接口并继承 BaseMapper（若使用 MyBatis-Plus）或遵循 MyBatis 的代理规范，配合 XML 映射文件或注解，处理标准的 CRUD 操作。
- **自定义 SQL 查询**：对于复杂查询，优先使用 XML 映射文件（<select>, <where>动态 SQL）编写 SQL；对于简单查询，可使用 @Select等注解。复杂的动态条件构建可使用 MyBatis-Plus 的 QueryWrapper/LambdaQueryWrapper。
- **结果映射与投影**：使用 ResultMap​ 进行字段映射；对于仅需部分字段的场景，直接在 SQL 中指定列名（如 SELECT id, name FROM ...），并将结果映射到 DTO 对象、Map​ 或 VO，避免 SELECT *带来的性能开销。

## 七、日志记录

- **SLF4J API**：使用 SLF4J 作为日志门面。  
- **日志声明**：`private static final Logger logger = LoggerFactory.getLogger(MyClass.class);`  
- **参数化日志**：使用参数化消息（如 `logger.info("Processing user {}...", userId);`）替代字符串拼接，以提升性能。

## 八、测试策略

- **单元测试**：使用 JUnit 5 和 Mockito 等模拟框架为服务和组件编写单元测试。  
- **集成测试**：通过 `@SpringBootTest` 加载 Spring 应用上下文，执行集成测试。  
- **测试切片**：使用 `@WebMvcTest`（控制器测试）等测试切片注解，隔离测试应用的特定部分。  
- **Testcontainers**：考虑使用 Testcontainers 实现基于真实数据库、消息队列等的可靠集成测试。

## 九、安全实践

- **Spring Security**：使用 Spring Security 实现认证与授权。  
- **密码加密**：始终使用 BCrypt 等强哈希算法加密密码。  
- **输入净化**：通过 MYBATIS PLUS 或参数化查询防止 SQL 注入；通过正确编码输出内容防范跨站脚本攻击（XSS）。

## 十、接口文档 

-- **契约先行与标准化**：优先采用 OpenAPI 规范 (OAS)​ 来描述 RESTful API。这不仅是文档，更是前后端联调、自动化测试和无缝集成的契约。
-- **自动化文档生成**：集成 SpringDoc OpenAPI（springdoc-openapi-starter-webmvc-ui）以替代老旧的 Springfox (Swagger)。利用注解（@Operation, @ApiResponse, @Schema）在代码中直接维护文档，确保文档与代码实现始终保持同步，杜绝“文档滞后”现象。
-- **接口分组与版本控制**：针对不同的 API 版本（如 /api/v1, /api/v2）或业务模块（如 admin, client），使用 GroupedOpenApi进行分组配置，使文档结构清晰，便于不同角色的开发者查阅。
-- **安全方案配置**：在 OpenAPI 配置中显式声明安全机制（如 JWT Bearer Token、OAuth2），确保文档中能直接进行授权调试，提升开发体验。
-- **生产环境管控**：在生产环境（Profile 为 prod）中，通过配置或代码逻辑禁用 Swagger UI 的访问入口，仅保留 JSON/YAML 格式的元数据输出（如 /v3/api-docs），或者直接完全禁用，以避免敏感信息泄露。

---
