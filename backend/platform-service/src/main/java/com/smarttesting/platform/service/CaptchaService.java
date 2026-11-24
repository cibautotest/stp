package com.smarttesting.platform.service;

import com.smarttesting.platform.model.CaptchaResponse;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Iterator;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 登录图形验证码服务（内存存储，无外部依赖）
 * - 生成：4 位、字符集排除易混淆字符（0/O/1/I/l 等），PNG base64 data URI
 * - 校验：忽略大小写、5 分钟过期、一次性消费（verify 即删，登录失败后旧码不可复用）
 */
@Service
public class CaptchaService {

    /** 排除易混淆字符：0/O、1/I/l、Z/2 等保留 2/Z 去掉 0/O/1/I/l */
    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 4;
    private static final long EXPIRE_MS = 5 * 60 * 1000L;
    private static final int IMG_WIDTH = 120;
    private static final int IMG_HEIGHT = 40;

    private static class CaptchaEntry {
        final String code;
        final long expireAt;

        CaptchaEntry(String code, long expireAt) {
            this.code = code;
            this.expireAt = expireAt;
        }
    }

    private final Map<String, CaptchaEntry> store = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();

    /**
     * 生成验证码：惰性清理过期项 → 随机码 → 绘制 PNG → base64 data URI
     */
    public CaptchaResponse generate() {
        long now = System.currentTimeMillis();
        for (Iterator<Map.Entry<String, CaptchaEntry>> it = store.entrySet().iterator(); it.hasNext(); ) {
            if (it.next().getValue().expireAt < now) {
                it.remove();
            }
        }

        StringBuilder code = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            code.append(CODE_CHARS.charAt(random.nextInt(CODE_CHARS.length())));
        }

        String image = drawImage(code.toString());
        String key = UUID.randomUUID().toString().replace("-", "");
        store.put(key, new CaptchaEntry(code.toString(), now + EXPIRE_MS));
        return new CaptchaResponse(key, image);
    }

    /**
     * 校验验证码（一次性：无论对错该 key 均被消费）。
     */
    public boolean verify(String key, String code) {
        if (key == null || key.isBlank() || code == null || code.isBlank()) {
            return false;
        }
        CaptchaEntry entry = store.remove(key);
        if (entry == null || System.currentTimeMillis() > entry.expireAt) {
            return false;
        }
        return entry.code.equalsIgnoreCase(code.trim());
    }

    /** 仅供单元测试读取明文验证码 */
    String peekCode(String key) {
        CaptchaEntry entry = store.get(key);
        return entry == null ? null : entry.code;
    }

    /**
     * 绘制验证码图片：浅色底 + 干扰线/噪点 + 随机旋转/偏移字符
     */
    private String drawImage(String code) {
        BufferedImage img = new BufferedImage(IMG_WIDTH, IMG_HEIGHT, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            // 浅色随机背景
            g.setColor(new Color(235 + random.nextInt(20), 238 + random.nextInt(17), 240 + random.nextInt(15)));
            g.fillRect(0, 0, IMG_WIDTH, IMG_HEIGHT);

            // 干扰线
            for (int i = 0; i < 12; i++) {
                g.setColor(randomColor(160, 255));
                g.setStroke(new BasicStroke(1 + random.nextFloat()));
                g.drawLine(random.nextInt(IMG_WIDTH), random.nextInt(IMG_HEIGHT),
                        random.nextInt(IMG_WIDTH), random.nextInt(IMG_HEIGHT));
            }

            // 字符：随机深色 + 旋转 ±25° + 纵向偏移
            g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 26));
            int x = 14;
            for (char c : code.toCharArray()) {
                g.setColor(randomColor(20, 120));
                AffineTransform old = g.getTransform();
                g.rotate(Math.toRadians(random.nextInt(50) - 25), x + 7, IMG_HEIGHT / 2.0);
                g.drawString(String.valueOf(c), x, 29 + random.nextInt(6));
                g.setTransform(old);
                x += (IMG_WIDTH - 24) / CODE_LENGTH;
            }

            // 噪点
            for (int i = 0; i < 40; i++) {
                g.setColor(randomColor(120, 255));
                g.fillRect(random.nextInt(IMG_WIDTH), random.nextInt(IMG_HEIGHT), 1, 1);
            }
        } finally {
            g.dispose();
        }

        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            ImageIO.write(img, "png", baos);
            return "data:image/png;base64," + Base64.getEncoder().encodeToString(baos.toByteArray());
        } catch (Exception e) {
            throw new IllegalStateException("验证码图片生成失败: " + e.getMessage(), e);
        }
    }

    private Color randomColor(int low, int high) {
        int span = high - low;
        return new Color(low + random.nextInt(span), low + random.nextInt(span), low + random.nextInt(span));
    }
}
