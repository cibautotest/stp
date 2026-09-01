package com.smarttesting.gateway;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.core.io.buffer.DataBufferUtils;
import org.springframework.core.io.buffer.DefaultDataBufferFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpRequestDecorator;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class GatewayRequestLoggingFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(GatewayRequestLoggingFilter.class);
    private static final int MAX_BODY_LOG_LENGTH = 8192;
    private static final Set<String> SENSITIVE_HEADERS = Set.of("authorization", "cookie", "set-cookie");

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        long start = System.currentTimeMillis();

        if (!hasLoggableBody(request)) {
            logRequest(request, null);
            return chain.filter(exchange)
                    .doFinally(signal -> logResponse(exchange, request, start));
        }

        return DataBufferUtils.join(request.getBody())
                .defaultIfEmpty(new DefaultDataBufferFactory().wrap(new byte[0]))
                .flatMap(dataBuffer -> {
                    byte[] bodyBytes = new byte[dataBuffer.readableByteCount()];
                    dataBuffer.read(bodyBytes);
                    DataBufferUtils.release(dataBuffer);

                    logRequest(request, toLogBody(bodyBytes, request.getHeaders()));

                    ServerHttpRequest decoratedRequest = new ServerHttpRequestDecorator(request) {
                        @Override
                        public Flux<DataBuffer> getBody() {
                            return Flux.defer(() -> {
                                DataBuffer buffer = exchange.getResponse().bufferFactory().wrap(bodyBytes);
                                return Mono.just(buffer);
                            });
                        }
                    };

                    return chain.filter(exchange.mutate().request(decoratedRequest).build())
                            .doFinally(signal -> logResponse(exchange, request, start));
                });
    }

    private void logRequest(ServerHttpRequest request, String body) {
        URI uri = request.getURI();
        log.info("[Gateway Request] method={}, uri={}, remoteAddress={}, headers={}, body={}",
                request.getMethod(), uri.getRawPath() + query(uri), request.getRemoteAddress(),
                headersToLogString(request.getHeaders()), body == null ? "<not-logged>" : body);
    }

    private void logResponse(ServerWebExchange exchange, ServerHttpRequest request, long start) {
        Integer status = exchange.getResponse().getRawStatusCode();
        log.info("[Gateway Response] method={}, uri={}, status={}, durationMs={}",
                request.getMethod(), request.getURI().getRawPath() + query(request.getURI()), status,
                System.currentTimeMillis() - start);
    }

    private boolean hasLoggableBody(ServerHttpRequest request) {
        HttpMethod method = request.getMethod();
        if (HttpMethod.GET.equals(method) || HttpMethod.DELETE.equals(method) || HttpMethod.HEAD.equals(method)) {
            return false;
        }
        MediaType contentType = request.getHeaders().getContentType();
        if (contentType == null) {
            return true;
        }
        String type = contentType.toString().toLowerCase(Locale.ROOT);
        return type.startsWith("text/")
                || type.contains("json")
                || type.contains("xml")
                || type.contains("x-www-form-urlencoded");
    }

    private String toLogBody(byte[] bodyBytes, HttpHeaders headers) {
        if (bodyBytes.length == 0) {
            return "";
        }
        Charset charset = headers.getContentType() == null || headers.getContentType().getCharset() == null
                ? StandardCharsets.UTF_8
                : headers.getContentType().getCharset();
        String body = new String(bodyBytes, charset);
        return truncate(body);
    }

    private String headersToLogString(HttpHeaders headers) {
        return headers.entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, entry -> maskHeader(entry.getKey(), entry.getValue())))
                .toString();
    }

    private List<String> maskHeader(String name, List<String> values) {
        if (SENSITIVE_HEADERS.contains(name.toLowerCase(Locale.ROOT))) {
            return List.of("***");
        }
        return values;
    }

    private String query(URI uri) {
        return uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery();
    }

    private String truncate(String value) {
        if (value.length() <= MAX_BODY_LOG_LENGTH) {
            return value;
        }
        return value.substring(0, MAX_BODY_LOG_LENGTH) + "...<truncated>";
    }
}
