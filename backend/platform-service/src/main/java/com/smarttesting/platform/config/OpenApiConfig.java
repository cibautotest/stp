package com.smarttesting.platform.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Knife4j / OpenAPI3 配置
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI smartTestingOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("智能测试平台 API")
                        .description("智能测试平台（Smart Testing Platform）RESTful API 接口文档")
                        .version("v1.0.0")
                        .contact(new Contact()
                                .name("Smart Testing Team"))
                        .license(new License()
                                .name("Apache 2.0")
                                .url("https://www.apache.org/licenses/LICENSE-2.0")));
    }
}
