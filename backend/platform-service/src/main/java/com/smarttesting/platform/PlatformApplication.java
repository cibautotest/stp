package com.smarttesting.platform;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.TimeZone;

/**
 * 平台业务服务
 */
@EnableAsync
@EnableScheduling
@EnableFeignClients
@EnableDiscoveryClient
@SpringBootApplication
public class PlatformApplication {

    public static void main(String[] args) {
        // Keep Platform-to-execute-service connections on IPv4 in local dual-stack
        // environments. This must be set before Spring initializes HTTP clients.
        System.setProperty("java.net.preferIPv4Stack", "true");
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Shanghai"));
        SpringApplication.run(PlatformApplication.class, args);
    }
}
