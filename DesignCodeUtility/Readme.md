Design Code Utility
===================

This npm package provides scripts for aiding development and deployment
of storefront assets onto Oracle Commerce Cloud Admin servers.

Operations, grouped by general function, are split across four tools:

* DCU - Downloading (grabbing) and Uploading (putting) assets between
        a local folder on your development machine and a remote OCC Admin
        Node. Transfer of assets from a source node to a different
        destination node is supported, provided both nodes are running
        identical OCC versions.

* CCW - Creating new item types (Widgets, Stacks, Elements) which can be
        deployed as extensions to a remote OCC Admin Node.

* PLSU - Transferring page layouts from one remote OCC Admin Node to
         a different destination node.

* CCPROXY - Testing Storefront content changes prior to upload by using a
            local Storefront-aware proxy layer to substitute server content
            with locally modified files.

