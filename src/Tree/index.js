import React from 'react';
import PropTypes from 'prop-types';
import { TransitionGroup } from 'react-transition-group';
import { layout, select, behavior, event } from 'd3';
import clone from 'clone';
import deepEqual from 'deep-equal';
import uuid from 'uuid';

import Node from '../Node';
import Link from '../Link';
import './style.css';

export default class Tree extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      data: this.assignInternalProperties(clone(props.data)),
    };
    this.internalState = {
      initialRender: true,
      targetNode: null,
      d3: {
        scale: this.props.zoom,
        translate: this.props.translate,
      },
    };
    this.findNodesById = this.findNodesById.bind(this);
    this.collapseNode = this.collapseNode.bind(this);
    this.handleNodeToggle = this.handleNodeToggle.bind(this);
    this.handleOnClickCb = this.handleOnClickCb.bind(this);
    this.handleOnMouseOverCb = this.handleOnMouseOverCb.bind(this);
    this.handleOnMouseOutCb = this.handleOnMouseOutCb.bind(this);
  }

  componentWillMount() {
    this.internalState.d3 = this.calculateD3Geometry(this.props);
  }

  componentDidMount() {
    this.bindZoomListener(this.props);
    this.internalState.initialRender = false;
  }

  componentDidUpdate() {
    if (typeof this.props.onUpdate === 'function') {
      this.props.onUpdate({
        node: this.internalState.targetNode ? clone(this.internalState.targetNode) : null,
        zoom: this.internalState.d3.scale,
        translate: this.internalState.d3.translate,
      });

      this.internalState.targetNode = null;
    }
  }

  componentWillReceiveProps(nextProps) {
    // Clone new data & assign internal properties
    if (this.props.data !== nextProps.data) {
      this.setState({
        data: this.assignInternalProperties(clone(nextProps.data)),
      });
    }

    this.internalState.d3 = this.calculateD3Geometry(nextProps);

    // If zoom-specific props change -> rebind listener with new values
    if (
      !deepEqual(this.props.translate, nextProps.translate) ||
      !deepEqual(this.props.scaleExtent, nextProps.scaleExtent) ||
      this.props.zoom !== nextProps.zoom
    ) {
      this.bindZoomListener(nextProps);
    }
  }

  /**
   * setInitialTreeDepth - Description
   *
   * @param {array} nodeSet Array of nodes generated by `generateTree`
   * @param {number} initialDepth Maximum initial depth the tree should render
   *
   * @return {void}
   */
  setInitialTreeDepth(nodeSet, initialDepth) {
    nodeSet.forEach(n => {
      n._collapsed = n.depth >= initialDepth;
    });
  }

  /**
   * bindZoomListener - If `props.zoomable`, binds a listener for
   * "zoom" events to the SVG and sets scaleExtent to min/max
   * specified in `props.scaleExtent`.
   *
   * @return {void}
   */
  bindZoomListener(props) {
    const { zoomable, scaleExtent, translate, zoom, onUpdate } = props;
    const svg = select('.rd3t-svg');
    const g = select('.rd3t-g');

    if (zoomable) {
      svg.call(
        behavior
          .zoom()
          .scaleExtent([scaleExtent.min, scaleExtent.max])
          .on('zoom', () => {
            g.attr('transform', `translate(${event.translate}) scale(${event.scale})`);
            if (typeof onUpdate === 'function') {
              // This callback is magically called not only on "zoom", but on "drag", as well,
              // even though event.type == "zoom".
              // Taking advantage of this and not writing a "drag" handler.
              onUpdate({
                node: null,
                zoom: event.scale,
                translate: { x: event.translate[0], y: event.translate[1] },
              });
              this.internalState.d3.scale = event.scale;
              this.internalState.d3.translate = { x: event.translate[0], y: event.translate[1] };
            }
          })
          // Offset so that first pan and zoom does not jump back to [0,0] coords
          .scale(zoom)
          .translate([translate.x, translate.y]),
      );
    }
  }

  /**
   * assignInternalProperties - Assigns internal properties to each node in the
   * `data` set that are required for tree manipulation and returns
   * a new `data` array.
   *
   * @param {array} data Hierarchical tree data
   *
   * @return {array} `data` array with internal properties added
   */
  assignInternalProperties(data) {
    return data.map(node => {
      node.id = uuid.v4();
      node._collapsed = false;
      // if there are children, recursively assign properties to them too
      if (node.children && node.children.length > 0) {
        node.children = this.assignInternalProperties(node.children);
        node._children = node.children;
      }
      return node;
    });
  }

  /**
   * findNodesById - Description
   *
   * @param {string} nodeId The `node.id` being searched for
   * @param {array} nodeSet Array of `node` objects
   * @param {array} hits Accumulator for matches, passed between recursive calls
   *
   * @return {array} Set of nodes matching `nodeId`
   */
  // TODO Refactor this into a more readable/reasonable recursive depth-first walk.
  findNodesById(nodeId, nodeSet, hits) {
    if (hits.length > 0) {
      return hits;
    }

    hits = hits.concat(nodeSet.filter(node => node.id === nodeId));

    nodeSet.forEach(node => {
      if (node._children && node._children.length > 0) {
        hits = this.findNodesById(nodeId, node._children, hits);
        return hits;
      }
      return hits;
    });

    return hits;
  }

  /**
   * collapseNode - Recursively sets the `_collapsed` property of
   * the passed `node` object and its children to `true`.
   *
   * @param {object} node Node object with custom properties
   *
   * @return {void}
   */
  collapseNode(node) {
    node._collapsed = true;
    if (node._children && node._children.length > 0) {
      node._children.forEach(child => {
        this.collapseNode(child);
      });
    }
  }

  /**
   * expandNode - Sets the `_collapsed` property of
   * the passed `node` object to `false`.
   *
   * @param {type} node Node object with custom properties
   *
   * @return {void}
   */
  expandNode(node) {
    node._collapsed = false;
  }

  /**
   * handleNodeToggle - Finds the node matching `nodeId` and
   * expands/collapses it, depending on the current state of
   * its `_collapsed` property.
   * `setState` callback receives targetNode and handles
   * `props.onClick` if defined.
   *
   * @param {string} nodeId A node object's `id` field.
   *
   * @return {void}
   */
  handleNodeToggle(nodeId, evt) {
    const data = clone(this.state.data);
    const matches = this.findNodesById(nodeId, data, []);
    const targetNode = matches[0];

    if (this.props.collapsible) {
      targetNode._collapsed ? this.expandNode(targetNode) : this.collapseNode(targetNode);
      this.setState({ data }, () => this.handleOnClickCb(targetNode, evt));
      this.internalState.targetNode = targetNode;
    } else {
      this.handleOnClickCb(targetNode, evt);
    }
  }

  /**
   * handleOnClickCb - Handles the user-defined `onClick` function
   *
   * @param {object} targetNode Description
   *
   * @return {void}
   */
  handleOnClickCb(targetNode, evt) {
    const { onClick } = this.props;
    if (onClick && typeof onClick === 'function') {
      onClick(clone(targetNode), evt);
    }
  }

  /**
   * handleOnMouseOverCb - Handles the user-defined `onMouseOver` function
   *
   * @param {string} nodeId
   *
   * @return {void}
   */
  handleOnMouseOverCb(nodeId, evt) {
    const { onMouseOver } = this.props;
    if (onMouseOver && typeof onMouseOver === 'function') {
      const data = clone(this.state.data);
      const matches = this.findNodesById(nodeId, data, []);
      const targetNode = matches[0];
      onMouseOver(clone(targetNode), evt);
    }
  }

  /**
   * handleOnMouseOutCb - Handles the user-defined `onMouseOut` function
   *
   * @param {string} nodeId
   *
   * @return {void}
   */
  handleOnMouseOutCb(nodeId, evt) {
    const { onMouseOut } = this.props;
    if (onMouseOut && typeof onMouseOut === 'function') {
      const data = clone(this.state.data);
      const matches = this.findNodesById(nodeId, data, []);
      const targetNode = matches[0];
      onMouseOut(clone(targetNode), evt);
    }
  }

  /**
   * generateTree - Generates tree elements (`nodes` and `links`) by
   * grabbing the rootNode from `this.state.data[0]`.
   * Restricts tree depth to `props.initialDepth` if defined and if this is
   * the initial render of the tree.
   *
   * @return {object} Object containing `nodes` and `links`.
   */
  generateTree() {
    const { initialDepth, depthFactor, separation, nodeSize, orientation } = this.props;

    const tree = layout
      .tree()
      .nodeSize(orientation === 'horizontal' ? [nodeSize.y, nodeSize.x] : [nodeSize.x, nodeSize.y])
      .separation(
        (a, b) => (a.parent.id === b.parent.id ? separation.siblings : separation.nonSiblings),
      )
      .children(d => (d._collapsed ? null : d._children));

    const rootNode = this.state.data[0];
    const nodes = tree.nodes(rootNode);
    const links = tree.links(nodes);

    // set `initialDepth` on first render if specified
    if (initialDepth !== undefined && this.internalState.initialRender) {
      this.setInitialTreeDepth(nodes, initialDepth);
    }

    if (depthFactor) {
      nodes.forEach(node => {
        node.y = node.depth * depthFactor;
      });
    }

    return { nodes, links };
  }

  /**
   * calculateD3Geometry - Set initial zoom and position.
   * Also limit zoom level according to `scaleExtent` on initial display. This is necessary,
   * because the first time we are setting it as an SVG property, instead of going
   * through D3's scaling mechanism, which would have picked up both properties.
   *
   * @param  {object} nextProps
   * @return {object} {translate: {x: number, y: number}, zoom: number}
   */
  calculateD3Geometry(nextProps) {
    let scale;

    if (nextProps.zoom > nextProps.scaleExtent.max) {
      scale = nextProps.scaleExtent.max;
    } else if (nextProps.zoom < nextProps.scaleExtent.min) {
      scale = nextProps.scaleExtent.min;
    } else {
      scale = nextProps.zoom;
    }

    return {
      translate: nextProps.translate,
      scale,
    };
  }

  render() {
    const { nodes, links } = this.generateTree();
    const {
      nodeSvgShape,
      nodeLabelComponent,
      orientation,
      pathFunc,
      transitionDuration,
      zoomable,
      textLayout,
      nodeSize,
      depthFactor,
      initialDepth,
      separation,
      circleRadius,
      allowForeignObjects,
      styles,
    } = this.props;
    const { translate, scale } = this.internalState.d3;

    const subscriptions = { ...nodeSize, ...separation, depthFactor, initialDepth };

    return (
      <div className={`rd3t-tree-container ${zoomable ? 'rd3t-grabbable' : undefined}`}>
        <svg className="rd3t-svg" width="100%" height="100%">
          <TransitionGroup
            component="g"
            className="rd3t-g"
            transform={`translate(${translate.x},${translate.y}) scale(${scale})`}
          >
            {links.map(linkData => (
              <Link
                key={uuid.v4()}
                orientation={orientation}
                pathFunc={pathFunc}
                linkData={linkData}
                transitionDuration={transitionDuration}
                styles={styles.links}
              />
            ))}

            {nodes.map(nodeData => (
              <Node
                key={nodeData.id}
                nodeSvgShape={{ ...nodeSvgShape, ...nodeData.nodeSvgShape }}
                nodeLabelComponent={nodeLabelComponent}
                nodeSize={nodeSize}
                orientation={orientation}
                transitionDuration={transitionDuration}
                nodeData={nodeData}
                name={nodeData.name}
                attributes={nodeData.attributes}
                onClick={this.handleNodeToggle}
                onMouseOver={this.handleOnMouseOverCb}
                onMouseOut={this.handleOnMouseOutCb}
                textLayout={textLayout}
                circleRadius={circleRadius}
                subscriptions={subscriptions}
                allowForeignObjects={allowForeignObjects}
                styles={styles.nodes}
              />
            ))}
          </TransitionGroup>
        </svg>
      </div>
    );
  }
}

Tree.defaultProps = {
  nodeSvgShape: {
    shape: 'circle',
    shapeProps: {
      r: 10,
    },
  },
  nodeLabelComponent: null,
  onClick: undefined,
  onMouseOver: undefined,
  onMouseOut: undefined,
  onUpdate: undefined,
  orientation: 'horizontal',
  translate: { x: 0, y: 0 },
  pathFunc: 'diagonal',
  transitionDuration: 500,
  depthFactor: undefined,
  collapsible: true,
  initialDepth: undefined,
  zoomable: true,
  zoom: 1,
  scaleExtent: { min: 0.1, max: 1 },
  nodeSize: { x: 140, y: 140 },
  separation: { siblings: 1, nonSiblings: 2 },
  textLayout: {
    textAnchor: 'start',
    x: 10,
    y: -10,
    transform: undefined,
  },
  allowForeignObjects: false,
  circleRadius: undefined, // TODO: DEPRECATE
  styles: {},
};

Tree.propTypes = {
  data: PropTypes.array.isRequired,
  nodeSvgShape: PropTypes.shape({
    shape: PropTypes.string,
    shapeProps: PropTypes.object,
  }),
  nodeLabelComponent: PropTypes.object,
  onClick: PropTypes.func,
  onMouseOver: PropTypes.func,
  onMouseOut: PropTypes.func,
  onUpdate: PropTypes.func,
  orientation: PropTypes.oneOf(['horizontal', 'vertical']),
  translate: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number,
  }),
  pathFunc: PropTypes.oneOfType([
    PropTypes.oneOf(['diagonal', 'elbow', 'straight']),
    PropTypes.func,
  ]),
  transitionDuration: PropTypes.number,
  depthFactor: PropTypes.number,
  collapsible: PropTypes.bool,
  initialDepth: PropTypes.number,
  zoomable: PropTypes.bool,
  zoom: PropTypes.number,
  scaleExtent: PropTypes.shape({
    min: PropTypes.number,
    max: PropTypes.number,
  }),
  nodeSize: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number,
  }),
  separation: PropTypes.shape({
    siblings: PropTypes.number,
    nonSiblings: PropTypes.number,
  }),
  textLayout: PropTypes.object,
  allowForeignObjects: PropTypes.bool,
  circleRadius: PropTypes.number,
  styles: PropTypes.shape({
    nodes: PropTypes.object,
    links: PropTypes.object,
  }),
};
