package com.smarttesting.platform.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Enumeration;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class HttpRequestLoggingFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(HttpRequestLoggingFilter.class);
    private static final int MAX_BODY_LOG_LENGTH = 8192;
    private static final Set<String> SENSITIVE_HEADERS = Set.of("authorization", "cookie", "set-cookie");

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        long start = System.currentTimeMillis();
        ContentCachingRequestWrapper wrappedRequest = new ContentCachingRequestWrapper(request);

        log.info("[Platform Request In] method={}, uri={}, remoteAddr={}, headers={}",
                request.getMethod(), requestUri(request), request.getRemoteAddr(), headersToLogString(request));

        try {
            filterChain.doFilter(wrappedRequest, response);
        } finally {
            log.info("[Platform Request Body] method={}, uri={}, body={}",
                    request.getMethod(), requestUri(request), requestBodyToLog(wrappedRequest));
            log.info("[Platform Response] method={}, uri={}, status={}, durationMs={}",
                    request.getMethod(), requestUri(request), response.getStatus(),
                    System.currentTimeMillis() - start);
        }
    }

    private String requestBodyToLog(ContentCachingRequestWrapper request) {
        if (!hasLoggableBody(request)) {
            return "<not-logged>";
        }
        byte[] body = request.getContentAsByteArray();
        if (body.length == 0) {
            return "";
        }
        String payload = new String(body, charset(request));
        return truncate(payload);
    }

    private boolean hasLoggableBody(HttpServletRequest request) {
        String method = request.getMethod();
        if ("GET".equalsIgnoreCase(method) || "DELETE".equalsIgnoreCase(method) || "HEAD".equalsIgnoreCase(method)) {
            return false;
        }
        String contentType = request.getContentType();
        if (contentType == null) {
            return true;
        }
        String type = contentType.toLowerCase(Locale.ROOT);
        return type.startsWith(MediaType.TEXT_PLAIN_VALUE)
                || type.contains("json")
                || type.contains("xml")
                || type.contains("x-www-form-urlencoded");
    }

    private Charset charset(HttpServletRequest request) {
        return request.getCharacterEncoding() == null
                ? StandardCharsets.UTF_8
                : Charset.forName(request.getCharacterEncoding());
    }

    private String headersToLogString(HttpServletRequest request) {
        return Collections.list(request.getHeaderNames()).stream()
                .collect(Collectors.toMap(name -> name, name -> headerValues(request, name)))
                .toString();
    }

    private String headerValues(HttpServletRequest request, String name) {
        if (SENSITIVE_HEADERS.contains(name.toLowerCase(Locale.ROOT))) {
            return "***";
        }
        Enumeration<String> headers = request.getHeaders(name);
        return Collections.list(headers).toString();
    }

    private String requestUri(HttpServletRequest request) {
        return request.getQueryString() == null
                ? request.getRequestURI()
                : request.getRequestURI() + "?" + request.getQueryString();
    }

    private String truncate(String value) {
        if (value.length() <= MAX_BODY_LOG_LENGTH) {
            return value;
        }
        return value.substring(0, MAX_BODY_LOG_LENGTH) + "...<truncated>";
    }
}
