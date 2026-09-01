import yaml from 'js-yaml';
import type { YamlDoc } from '../models/test-case.js';
import { ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export class YamlValidator {
  /**
   * 基础校验：YAML 语法 + 必要字段
   * 不再做深度解析，具体 YAML 结构由 Midscene agent.runYaml() 内部处理
   */
  validate(yamlScript: string, inputName: string): YamlDoc {
    let doc: any;

    // 1. YAML 语法解析
    try {
      doc = yaml.load(yamlScript);
    } catch (err) {
      throw new ValidationError(`YAML 语法错误: ${(err as Error).message}`);
    }

    if (!doc || typeof doc !== 'object') {
      throw new ValidationError('YAML 内容为空或格式错误');
    }

    // 2. web.url 必须存在
    if (!doc.web?.url) {
      throw new ValidationError('web.url 是必填项（Midscene 标准格式）');
    }

    // 3. tasks 必须存在且非空
    if (!doc.tasks || !Array.isArray(doc.tasks) || doc.tasks.length === 0) {
      throw new ValidationError('tasks 不能为空，至少需要一个任务');
    }

    logger.info(
      { name: inputName, tasks: doc.tasks.length, url: doc.web.url },
      'YAML 校验通过',
    );

    return doc as YamlDoc;
  }
}
