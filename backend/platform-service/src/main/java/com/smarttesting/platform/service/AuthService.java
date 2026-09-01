package com.smarttesting.platform.service;

import com.smarttesting.platform.entity.User;
import com.smarttesting.platform.security.JwtUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;

import javax.annotation.Resource;
import javax.servlet.http.HttpServletResponse;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * 认证服务 — 登录认证
 */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    @Resource
    private UserService userService;

    @Resource
    private JwtUtil jwtUtil;

    @Resource
    private PasswordEncoder passwordEncoder;

    @Value("${security.cookie-secure:false}")
    private boolean cookieSecure;

    /**
     * 用户登录
     *
     * @param username 用户名
     * @param password 明文密码
     * @return token + 用户信息，或 null（认证失败）
     */
    public Map<String, Object> login(String username, String password, HttpServletResponse response) {
        // 1. 查询用户
        User user = userService.getByUsername(username);
        if (user == null) {
            log.warn("[Auth] Login failed - user not found: {}", username);
            return null;
        }

        // 2. 检查状态
        if (user.getStatus() == 0) {
            log.warn("[Auth] Login failed - user disabled: {}", username);
            return null;
        }

        // 3. 验证密码
        if (!passwordEncoder.matches(password, user.getPassword())) {
            log.warn("[Auth] Login failed - wrong password: {}", username);
            return null;
        }

        // 4. 更新最后登录时间
        user.setLastLoginAt(LocalDateTime.now());
        userService.updateById(user);

        // 5. 生成 Token
        String token = jwtUtil.generateToken(user.getId(), user.getUsername(), user.getRole());
        response.addHeader("Set-Cookie", String.format(
                "token=%s; Max-Age=%d; Path=/; HttpOnly; SameSite=Strict%s",
                token, 24 * 60 * 60, cookieSecure ? "; Secure" : ""));

        // 6. 返回结果（不包含密码）
        Map<String, Object> result = new HashMap<>();

        Map<String, Object> userInfo = new HashMap<>();
        userInfo.put("id", user.getId());
        userInfo.put("username", user.getUsername());
        userInfo.put("displayName", user.getDisplayName());
        userInfo.put("role", user.getRole());
        userInfo.put("status", user.getStatus());
        userInfo.put("executeServiceUrl", user.getExecuteServiceUrl());
        result.put("user", userInfo);

        log.info("[Auth] Login success: username={}, role={}", username, user.getRole());
        return result;
    }
}
