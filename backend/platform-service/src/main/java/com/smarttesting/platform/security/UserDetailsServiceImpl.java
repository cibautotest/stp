package com.smarttesting.platform.security;

import com.smarttesting.platform.entity.User;
import com.smarttesting.platform.service.UserService;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.util.List;

/**
 * 加载用户信息 — 供 Spring Security {@link org.springframework.security.authentication.dao.DaoAuthenticationProvider} 使用
 */
@Service
public class UserDetailsServiceImpl implements UserDetailsService {

    @Resource
    private UserService userService;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userService.getByUsername(username);
        if (user == null) {
            throw new UsernameNotFoundException("User not found: " + username);
        }
        if (user.getStatus() == 0) {
            throw new UsernameNotFoundException("User is disabled: " + username);
        }

        return new org.springframework.security.core.userdetails.User(
                String.valueOf(user.getId()),
                user.getPassword(),
                user.getStatus() == 1,
                true, true, true,
                List.of(() -> "ROLE_" + user.getRole().toUpperCase())
        );
    }
}
