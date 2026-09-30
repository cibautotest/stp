/**
 * YamlRunner 纯逻辑单测（示例：red-green 节奏）
 * 覆盖点：buildLoginYaml（登录 YAML 生成策略）与 urlsEqual（URL 规范化比较）
 * 说明：两方法为 private，通过 as any 访问；不涉及浏览器与网络
 */
import { describe, it, expect } from 'vitest';
import { YamlRunner } from '../src/core/yaml-runner.js';

const runner = new YamlRunner() as any;

describe('buildLoginYaml', () => {
  it('按 账号/密码/登录按钮 模板生成登录 YAML', () => {
    const yaml = runner.buildLoginYaml({
      id: 'lm1', type: 'cas', username: 'admin', password: 'Test@123',
    });
    expect(yaml).toContain("aiInput: 'admin'");
    expect(yaml).toContain("aiInput: 'Test@123'");
    expect(yaml).toContain('点击登录按钮');
    expect(yaml).toContain('aiWaitFor');
  });

  it('[动态] 前缀的补充步骤自动标记 cacheable: false', () => {
    const yaml = runner.buildLoginYaml({
      id: 'lm1', type: 'cas', username: 'u', password: 'p',
      stepsNlp: '[动态] 识别图形验证码并填入\n选择角色进入系统',
    });
    expect(yaml).toContain('识别图形验证码并填入');
    expect(yaml).toContain('cacheable: false');
    expect(yaml).toContain('选择角色进入系统');
    // 非动态步骤不应带 cacheable: false（只有一个动态步骤）
    expect(yaml.match(/cacheable: false/g)).toHaveLength(1);
    // [动态] 标记本身不应残留在最终 YAML 文本中
    expect(yaml).not.toContain('[动态]');
  });

  it('账号密码中的单引号被转义', () => {
    const yaml = runner.buildLoginYaml({
      id: 'lm1', type: 'local', username: "ad'min", password: 'p',
    });
    expect(yaml).toContain("aiInput: 'ad''min'");
  });

  it('优先使用预生成的 yamlScript（含 tasks）', () => {
    const yaml = runner.buildLoginYaml({
      id: 'lm1', type: 'cas',
      yamlScript: 'web:\n  url: http://x\ntasks:\n  - name: 登录\n    flow:\n      - aiTap: 登录\n',
    });
    expect(yaml).toContain('tasks');
    expect(yaml).not.toContain('web:');
  });
});

describe('urlsEqual', () => {
  it('忽略协议、末尾斜杠与 hash 后判定相等', () => {
    expect(runner.urlsEqual('http://localhost:3000/#/login', 'https://localhost:3000/')).toBe(true);
    expect(runner.urlsEqual('https://a.com/x/', 'http://a.com/x#frag')).toBe(true);
  });

  it('不同路径判定不等', () => {
    expect(runner.urlsEqual('http://a.com/login', 'http://a.com/home')).toBe(false);
  });
});
