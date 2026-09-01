package com.smarttesting.platform.controller;

import com.smarttesting.platform.entity.User;
import com.smarttesting.platform.model.LoginRequest;
import com.smarttesting.platform.model.UserSettingsRequest;
import com.smarttesting.platform.service.AuthService;
import com.smarttesting.platform.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.annotation.Resource;
import javax.servlet.http.HttpServletResponse;
import javax.validation.Valid;
import java.util.HashMap;
import java.util.Map;

@Tag(name = "Auth", description = "Login and current user APIs")
@RestController
@RequestMapping("/api/platform/auth")
public class AuthController {

    @Resource
    private AuthService authService;

    @Resource
    private UserService userService;

    @Operation(summary = "Login")
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest body, HttpServletResponse response) {
        Map<String, Object> result = authService.login(body.getUsername(), body.getPassword(), response);
        if (result == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid username or password"));
        }
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Get current user")
    @GetMapping("/me")
    public ResponseEntity<?> me(Authentication authentication) {
        if (authentication == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        Long userId = (Long) authentication.getPrincipal();
        User user = userService.getById(userId);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "User not found"));
        }

        return ResponseEntity.ok(toUserInfo(user));
    }

    @Operation(summary = "Update current user settings")
    @PutMapping("/me/settings")
    public ResponseEntity<?> updateMySettings(Authentication authentication, @Valid @RequestBody UserSettingsRequest body) {
        if (authentication == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        Long userId = (Long) authentication.getPrincipal();
        User user = userService.getById(userId);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "User not found"));
        }

        if (body.getExecuteServiceUrl() != null) {
            user.setExecuteServiceUrl(body.getExecuteServiceUrl().trim());
        }
        if (body.getDisplayName() != null) {
            String displayName = body.getDisplayName().trim();
            if (!displayName.isBlank()) {
                user.setDisplayName(displayName);
            }
        }

        userService.updateById(user);
        return ResponseEntity.ok(toUserInfo(user));
    }

    @Operation(summary = "Logout")
    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletResponse response) {
        response.setHeader("Set-Cookie", "token=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict");
        return ResponseEntity.ok(Map.of("message", "Logged out"));
    }

    private Map<String, Object> toUserInfo(User user) {
        Map<String, Object> userInfo = new HashMap<>();
        userInfo.put("id", user.getId());
        userInfo.put("username", user.getUsername());
        userInfo.put("displayName", user.getDisplayName());
        userInfo.put("role", user.getRole());
        userInfo.put("status", user.getStatus());
        userInfo.put("executeServiceUrl", user.getExecuteServiceUrl());
        userInfo.put("createdAt", user.getCreatedAt());
        return userInfo;
    }
}
