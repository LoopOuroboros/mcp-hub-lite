import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ToolCallDialog from '@frontend/components/ToolCallDialog.vue';

// Mock vue-i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}));

// Mock http
vi.mock('@utils/http', () => ({
  http: {
    get: vi.fn().mockResolvedValue([])
  },
  HttpError: class extends Error {}
}));

// Mock Element Plus
const ElDialog = {
  template: '<div><slot /><slot name="footer" /></div>',
  props: ['modelValue']
};

describe('ToolCallDialog Component', () => {
  it('should initialize argsJson on mount when modelValue is true', () => {
    const wrapper = mount(ToolCallDialog, {
      props: {
        modelValue: true,
        toolName: 'test-tool',
        inputSchema: {
          type: 'object',
          properties: {
            timezone: {
              type: 'string',
              default: 'UTC'
            }
          }
        }
      },
      global: {
        components: {
          'el-dialog': ElDialog
        },
        stubs: {
          'el-select': true,
          'el-option': true,
          'el-input': {
            template:
              '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
            props: ['modelValue']
          },
          'el-button': true,
          'el-icon': true
        }
      }
    });

    // Access the component instance to check refs
    const vm = wrapper.vm as unknown as { argsJson: string };
    // argsJson should be populated based on schema
    const expected = {
      timezone: 'UTC'
    };
    expect(JSON.parse(vm.argsJson)).toEqual(expected);
  });
});
