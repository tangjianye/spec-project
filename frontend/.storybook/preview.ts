import type { Preview } from '@storybook/react';
import '../src/styles/global.css';

const preview: Preview = {
  parameters: {
    controls: { expanded: true },
    a11y: {
      config: { rules: [{ id: 'color-contrast', enabled: true }] }
    }
  }
};

export default preview;
