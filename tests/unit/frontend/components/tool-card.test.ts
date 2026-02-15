import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ToolCard from '@frontend/components/ToolCard.vue';

describe('ToolCard Component', () => {
  it('should render title correctly', () => {
    const wrapper = mount(ToolCard, {
      props: {
        title: 'test-tool'
      }
    });

    expect(wrapper.text()).toContain('test-tool');
    expect(wrapper.find('.font-mono').text()).toBe('test-tool');
  });

  it('should render description when provided', () => {
    const wrapper = mount(ToolCard, {
      props: {
        title: 'test-tool',
        description: 'This is a test tool'
      }
    });

    expect(wrapper.text()).toContain('This is a test tool');
  });

  it('should render default description when not provided', () => {
    const wrapper = mount(ToolCard, {
      props: {
        title: 'test-tool'
      }
    });

    expect(wrapper.text()).toContain('tools.noDescription');
  });

  it('should render tag when tagName is provided', () => {
    const wrapper = mount(ToolCard, {
      props: {
        title: 'test-tool',
        tagName: 'server-1'
      }
    });

    expect(wrapper.text()).toContain('server-1');
    expect(wrapper.find('span.bg-gray-100').exists()).toBe(true);
  });

  it('should use custom tagClass when provided', () => {
    const wrapper = mount(ToolCard, {
      props: {
        title: 'test-tool',
        tagName: 'server-1',
        tagClass: 'custom-class'
      }
    });

    expect(wrapper.find('span.custom-class').exists()).toBe(true);
  });

  it('should emit call event when clicked', async () => {
    const wrapper = mount(ToolCard, {
      props: {
        title: 'test-tool'
      }
    });

    await wrapper.trigger('click');
    expect(wrapper.emitted('call')).toHaveLength(1);
  });
});
