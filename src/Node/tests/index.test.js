import React from 'react';
import { shallow, mount } from 'enzyme';

import Node from '../index.tsx';

describe('<Node />', () => {
  const data = {
    id: 'abc123',
    name: 'mockNode',
  };

  const mockProps = {
    data,
    nodeSize: {
      x: 123,
      y: 321,
    },
    position: {
      x: 111,
      y: 222,
    },
    depth: 3,
    nodeElement: {
      tag: 'circle',
      baseProps: {
        r: 10,
      },
    },
    attributes: {
      testkeyA: 'testvalA',
      testKeyB: 'testvalB',
    },
    orientation: 'horizontal',
    parent: {
      x: 999,
      y: 888,
    },
    transitionDuration: 500,
    onClick: () => {},
    onMouseOver: () => {},
    onMouseOut: () => {},
    textLayout: {
      textAnchor: 'start',
      x: 10,
      y: -10,
    },
    subscriptions: {},
    allowForeignObjects: false,
  };

  jest.spyOn(Node.prototype, 'applyTransform');

  // Clear method spies on prototype after each test
  afterEach(() => jest.clearAllMocks());

  it('has the correct `id` attribute value', () => {
    const renderedComponent = shallow(<Node {...mockProps} />);

    expect(renderedComponent.find('g').prop('id')).toBe(data.id);
  });

  it('applies correct base className if `data._children` is defined', () => {
    const leafNodeComponent = shallow(<Node {...mockProps} />);
    const nodeComponent = shallow(<Node {...mockProps} data={{ ...data, _children: [] }} />);

    expect(leafNodeComponent.find('g').prop('className')).toBe('leafNodeBase');
    expect(nodeComponent.find('g').prop('className')).toBe('nodeBase');
  });

  it('applies correct `transform` prop based on its `orientation`', () => {
    const horizontalTransform = `translate(${mockProps.parent.y},${mockProps.parent.x})`;
    const verticalTransform = `translate(${mockProps.parent.x},${mockProps.parent.y})`;
    const horizontalComponent = shallow(<Node {...mockProps} />);
    const verticalComponent = shallow(<Node {...mockProps} orientation="vertical" />);
    expect(horizontalComponent.find('g').prop('transform')).toBe(horizontalTransform);
    expect(verticalComponent.find('g').prop('transform')).toBe(verticalTransform);
  });

  describe('Events', () => {
    it('handles onClick events and passes its nodeId & event object to onClick handler', () => {
      const onClickSpy = jest.fn();
      const mockEvt = { mock: 'event' };
      const renderedComponent = shallow(<Node {...mockProps} onClick={onClickSpy} />);

      renderedComponent.simulate('click', mockEvt);
      expect(onClickSpy).toHaveBeenCalledTimes(1);
      expect(onClickSpy).toHaveBeenCalledWith(data.id, expect.objectContaining(mockEvt));
    });

    it('handles onMouseOver events and passes its nodeId & event object to onMouseOver handler', () => {
      const onMouseOverSpy = jest.fn();
      const mockEvt = { mock: 'event' };
      const renderedComponent = shallow(<Node {...mockProps} onMouseOver={onMouseOverSpy} />);

      renderedComponent.simulate('mouseover', mockEvt);
      expect(onMouseOverSpy).toHaveBeenCalledTimes(1);
      expect(onMouseOverSpy).toHaveBeenCalledWith(data.id, expect.objectContaining(mockEvt));
    });

    it('handles onMouseOut events and passes its nodeId & event object to onMouseOut handler', () => {
      const onMouseOutSpy = jest.fn();
      const mockEvt = { mock: 'event' };
      const renderedComponent = shallow(<Node {...mockProps} onMouseOut={onMouseOutSpy} />);

      renderedComponent.simulate('mouseout', mockEvt);
      expect(onMouseOutSpy).toHaveBeenCalledTimes(1);
      expect(onMouseOutSpy).toHaveBeenCalledWith(data.id, expect.objectContaining(mockEvt));
    });
  });

  it('applies its own x/y coords on `transform` once mounted', () => {
    const fixture = `translate(${mockProps.position.y},${mockProps.position.x})`;
    const renderedComponent = mount(<Node {...mockProps} />);

    expect(renderedComponent.instance().applyTransform).toHaveBeenCalledWith(
      fixture,
      mockProps.transitionDuration
    );
  });

  describe('Update Positioning', () => {
    it('updates its position if `data.x` or `data.y` changes', () => {
      const updatedProps = {
        ...mockProps,
        x: 1,
        y: 2,
        data: {
          ...mockProps.data,
        },
      };
      const initialTransform = `translate(${mockProps.position.y},${mockProps.position.x})`;
      const updatedTransform = `translate(${updatedProps.position.y},${updatedProps.position.x})`;
      const renderedComponent = mount(<Node {...mockProps} />);

      expect(renderedComponent.instance().applyTransform).toHaveBeenCalledWith(
        initialTransform,
        mockProps.transitionDuration
      );

      renderedComponent.setProps(updatedProps);

      expect(renderedComponent.instance().applyTransform).toHaveBeenCalledWith(
        updatedTransform,
        mockProps.transitionDuration
      );
    });

    it('updates its position if `orientation` changes', () => {
      const thisProps = { ...mockProps, shouldTranslateToOrigin: true, orientation: 'horizontal' };
      delete thisProps.parent;
      const renderedComponent = mount(<Node {...thisProps} />);
      const nextProps = { ...thisProps, orientation: 'vertical' };
      expect(
        renderedComponent.instance().shouldNodeTransform(renderedComponent.props(), nextProps)
      ).toBe(true);
    });

    it('updates its position if any subscribed top-level props change', () => {
      const subscriptions = { x: 12, y: 10, initialDepth: undefined };
      const renderedComponent = mount(<Node {...mockProps} subscriptions={subscriptions} />);
      const nextProps = { ...mockProps, subscriptions: { ...subscriptions, initialDepth: 1 } };

      expect(
        renderedComponent.instance().shouldNodeTransform(renderedComponent.props(), nextProps)
      ).toBe(true);
    });
  });

  // TODO: should default to circle tag if not provided
  describe('NodeElement', () => {
    it('allows passing SVG tag + baseProps to be used as the node element', () => {
      const fixture = { tag: 'ellipse', baseProps: { rx: 20, ry: 10 } };
      const props = { ...mockProps, nodeElement: fixture };
      const renderedComponent = shallow(<Node {...props} />);

      expect(renderedComponent.find(fixture.tag).length).toBe(1);
      expect(renderedComponent.find(fixture.tag).props()).toEqual(fixture.baseProps);
    });
    it('renders the appropriate SVG element if `props.nodeElement` is defined', () => {
      const props = { ...mockProps, nodeElement: { tag: 'rect', baseProps: { y: 123 } } };
      const renderedComponent = shallow(<Node {...props} />);
      expect(renderedComponent.find('rect').length).toBe(1);
      expect(renderedComponent.find('rect').prop('y')).toBe(123);
    });

    it('renders nothing if `nodeElement.tag` is set to `none`', () => {
      const props = { ...mockProps, nodeElement: { tag: 'none' } };
      const renderedComponent = shallow(<Node {...props} />);
      expect(renderedComponent.instance().renderNodeElement({})).toBe(null);
    });

    it('merges `branchNodeProps` into `baseProps` if node has `_children`', () => {
      const fixture = {
        nodeElement: {
          tag: 'rect',
          branchNodeProps: { fill: 'green', r: 20 },
        },
      };
      // const leafNodeComponent = shallow(<Node {...mockProps} />);
      const renderedComponent = shallow(
        <Node {...mockProps} {...fixture} data={{ ...data, _children: [{}] }} />
      );

      expect(renderedComponent.find(fixture.nodeElement.tag).props()).toEqual(
        fixture.nodeElement.branchNodeProps
      );
    });

    it('merges `leafNodeProps` into `baseProps` if node has no children', () => {
      const fixture = {
        nodeElement: {
          tag: 'rect',
          leafNodeProps: { fill: 'red', r: 15 },
        },
      };
      // const leafNodeComponent = shallow(<Node {...mockProps} />);
      const renderedComponent = shallow(<Node {...mockProps} {...fixture} />);

      expect(renderedComponent.find(fixture.nodeElement.tag).props()).toEqual(
        fixture.nodeElement.leafNodeProps
      );
    });

    // // FIXME: move to SgTextElement tests?
    // it('applies correct node name styles depending on `nodeData._children`', () => {
    //   const fixture = {
    //     node: {
    //       name: { stroke: '#000' },
    //     },
    //     leafNode: {
    //       name: { stroke: '#fff' },
    //     },
    //   };
    //   const leafNodeComponent = mount(<Node {...mockProps} styles={fixture} />);
    //   const nodeComponent = mount(
    //     <Node {...mockProps} nodeData={{ ...nodeData, _children: [] }} styles={fixture} />,
    //   );

    //   expect(leafNodeComponent.find('.nodeNameBase').prop('style')).toBe(fixture.leafNode.name);
    //   expect(nodeComponent.find('.nodeNameBase').prop('style')).toBe(fixture.node.name);
    // });
  });

  describe('NodeLabelElement', () => {
    it('renders a SvgTextElement by default', () => {
      const renderedComponent = shallow(<Node {...mockProps} />);
      expect(renderedComponent.find('SvgTextElement').length).toBe(1);
    });

    it('renders a ForeignObjectElement if `props.allowForeignObjects && props.nodeLabelComponent`', () => {
      const renderedComponent = shallow(
        <Node {...mockProps} nodeLabelComponent={{ render: <div /> }} allowForeignObjects />
      );
      expect(renderedComponent.find('ForeignObjectElement').length).toBe(1);
    });
  });
});
