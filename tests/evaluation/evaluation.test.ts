import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * MCP Evaluation Tests - Verify the integrity and format correctness of evaluation test files
 *
 * These tests ensure that evaluation test files comply with the requirements of the MCP evaluation guidelines
 */
describe('MCP Evaluation Tests', () => {
  const evaluationFile = path.resolve(__dirname, 'evaluation.xml');

  it('should have evaluation.xml file', () => {
    expect(fs.existsSync(evaluationFile)).toBe(true);
  });

  it('should have valid XML format', () => {
    const content = fs.readFileSync(evaluationFile, 'utf-8');
    expect(content).toContain('<evaluation>');
    expect(content).toContain('</evaluation>');
  });

  it('should have exactly 10 QA pairs', () => {
    const content = fs.readFileSync(evaluationFile, 'utf-8');
    const qaPairCount = (content.match(/<qa_pair>/g) || []).length;
    expect(qaPairCount).toBe(10);
  });

  it('should have valid question and answer fields', () => {
    const content = fs.readFileSync(evaluationFile, 'utf-8');
    const qaPairs = content.match(/<qa_pair>([\s\S]*?)<\/qa_pair>/g) || [];

    qaPairs.forEach((qaPair) => {
      expect(qaPair).toContain('<question>');
      expect(qaPair).toContain('</question>');
      expect(qaPair).toContain('<answer>');
      expect(qaPair).toContain('</answer>');

      // Check that question and answer content are not empty
      const question = qaPair.match(/<question>([\s\S]*?)<\/question>/)?.[1].trim();
      const answer = qaPair.match(/<answer>([\s\S]*?)<\/answer>/)?.[1].trim();

      expect(question).toBeTruthy();
      expect(answer).toBeTruthy();

      if (question && answer) {
        // Check that question length is reasonable
        expect(question.length).toBeGreaterThan(10);
        expect(question.length).toBeLessThan(500);

        // Check that answer length is reasonable
        expect(answer.length).toBeGreaterThan(10);
        expect(answer.length).toBeLessThan(500);
      }
    });
  });

  it('should have independent and complex questions', () => {
    const content = fs.readFileSync(evaluationFile, 'utf-8');
    const questions = (content.match(/<question>([\s\S]*?)<\/question>/g) || []).map(match =>
      match.replace(/<\/?question>/g, '').trim()
    );

    // Check if questions contain keywords that require multiple tool calls
    const complexQuestionIndicators = [
      'List', 'Count', 'Find', 'Get', 'Distributed', 'Calculate', 'Group', 'Total number', 'Average', 'Filter'
    ];

    questions.forEach((question, index) => {
      const hasComplexIndicator = complexQuestionIndicators.some(indicator =>
        question.includes(indicator)
      );

      expect(hasComplexIndicator, `Question ${index + 1} does not appear to be complex enough: "${question}"`).toBe(true);
    });
  });

  it('should have read-only operations', () => {
    const content = fs.readFileSync(evaluationFile, 'utf-8');
    const answers = (content.match(/<answer>([\s\S]*?)<\/answer>/g) || []).map(match =>
      match.replace(/<\/?answer>/g, '').trim()
    );

    // Check if answers contain keywords for destructive operations
    const destructiveIndicators = [
      'Create', 'Delete', 'Update', 'Modify', 'Add', 'Remove', 'Execute', 'Run'
    ];

    answers.forEach((answer, index) => {
      const hasDestructiveIndicator = destructiveIndicators.some(indicator =>
        answer.includes(indicator)
      );

      expect(hasDestructiveIndicator, `Answer ${index + 1} may contain destructive operations: "${answer}"`).toBe(false);
    });
  });

  it('should reference valid tools', () => {
    const validTools = [
      'list-servers', 'find-servers', 'list-all-tools-in-server',
      'find-tools-in-server', 'get-tool', 'call-tool', 'find-tools'
    ];

    const content = fs.readFileSync(evaluationFile, 'utf-8');

    validTools.forEach(tool => {
      expect(content).toContain(tool);
    });
  });
});