package com.smarttesting.platform.controller;


import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "测试控制器", description = "测试一下")
@RestController
@RequestMapping("/api/test")
public class TestController {

    @GetMapping("/1")
    @Operation(summary = "测试接口1", description = "测试接口1111")
    public String test1() {
        return "test1";
    }
}
