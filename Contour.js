/**-
 * Copyright (c) 1986-2023 Richard K. Wright. All rights reserved.
 *
 * This work is licensed under the terms of the MIT license.
 * For a copy, see <https://opensource.org/licenses/MIT>.
 *
 * Contour.js
 *
 */

'use strict';

//--- Contour class constants ---
const DELTA_DIV = 10000;

const MIN_FLOAT= -1e37;
const MAX_FLOAT = 1e37;

const CLOCKWISE = 1
const CLOSED = 0;
const COUNTERCLOCKWISE = -1;
const UNDEFINED = 254;

const MAX_LOOP_LIMIT = 255;

const HORIZONTAL = 0;
const VERTICAL = 1;

const LEFT_EDGE = 0;
const TOP_EDGE = 1;
const RIGHT_EDGE = 2;
const BOTTOM_EDGE = 3;

const TOP_BOT_EDGE = 1;		// if edg & this, then TOP or BOTTOM

const EPSILON = 0.0005;

const xdirec = [ 1, 0, -1, 0 ];
const ydirec = [ 0, 1, 0, -1 ];
const nexd = [ 1, 2, 3, 0 ];
const nsd = [ 3, 0, 1, 2 ];
const id = [ 2, 3, 0, 1 ];

/**
 *
 * @author riwright
 *
 */
class ContourLimit {
    top0 = MAX_LOOP_LIMIT;	 	// Contour limits for a given cell, limb 0
    bot0 = MAX_LOOP_LIMIT;
    top1 = MAX_LOOP_LIMIT; 		// Contour limits for a given cell, limb 1
    bot1 = MAX_LOOP_LIMIT;
    CW0  = UNDEFINED; 		// sign of slope of limb intersected by vector
    CW1  = UNDEFINED; 		// sign of slope of limb intersected by vector
}

/**
 *
 *
 *  This class defines the upper and lower limits of the contours for each
 *   cell, where
 *
 *                              for a given cell, whose actual data point
 *                              is represented by the '*'
 *          l   +------+        limb = 1 is the left-side of the cell,
 *     ^    i   |      |        limb = 0 is the bottom of the cell
 *     |    m   |      |
 *   incr   b   |      |
 *     Y    1   *------+
 *               limb = 0
 *
 *           --> increasing x
 *
 *
 *  Note on the slope parameter:  the parm represents the sign of the
 *  slope along the direction of travel for the vector, where it
 *  it intersects the edge:
 *		 not edge             = 0,
 *		 higher elev to right = +1  ->   clockwise
 *		 higher elev to left  = -1	->   counterclockwise
 *
 *  hence if one goes clockwise, the higher elev will be encircled.
 */
class ContourVector {
    x = [];  // coordinate arrays
    y = [];

    elmKnt;         // number of elms in the coordinate array
    stCW; 			// sign of slope of start edge limb intersected by vector
    finCW; 			// sign of slope of finish edge limb intersected by vector
    stEdge; 		// edge number for start
    finEdge; 		// edge number for finish
}

/**
 *
 */
class Contour  {

    //--- constants ---
    REVISION = '0.2.0';

    ns; 			// first index in X
    nf; 			// last index in X
    ms; 			// first index in Y
    mf; 			// last index in Y
    ccwKnt; 		// accumulates the CCW/CW count
    nCont;			// number of contours to be found

    bounds = [];            // contouring limits for each cell - ContourLimits
    contourVectors = [];    // ContourVector
    contLevels = [];        // float, contour limits

    /**
     * Required constructor, currently unused
     */
    constructor () {
    }

    /**
     *
     * @param array
     * @param contLevel
     */
    threadContours ( array,  contLevel ) {

        console.log("Threading Contour. Array size: " + array.length +
                            "  contour level: " + contLevel.toFixed(1));
    }

    /**
     *
     * @param array
     * @param contInterval
     */
    allocBounds ( array, contInterval ) {
        this.mf = array.length;
        this.nf = array[0].length;
        this.ns = 0;
        this.ms = 0;

        this.bounds = [];
        for ( let i = ms; i < mf; i++ ) {
            this.bounds[i] = [];
            for ( let j = ns; j < nf; j++ ) {
                this.bounds[i][j] = new ContourLimit();
            }
        }

        this.nCont = Math.ceil((maxZ - minZ) / contInterval);

        for ( let i = 0; i < this.nCont; i++ )
        {
            this.contLevels.push(minZ + i * contInterval);
        }

        this.delta = (maxZ - minZ) / DELTA_DIV;
    }

    /**
     *
     * @param array
     * @param contInterval
     */
    setContLevels ( array, contInterval ) {
        // find max and min in the array
        let minZ = MAX_FLOAT;
        let maxZ = -MAX_FLOAT;

        for (let i = ms; i < mf; i++) {
            for (let j = ns; j < nf; j++) {
                minZ = Math.min(minZ, array[i][j]);
                maxZ = Math.max(maxZ, array[i][j]);
            }
        }

        /**
         * @param array
         * @param contInterval
         *
         * Initialize the flag array, setting the upper and lower bounds
         * for the contours for each segment as well as the winding direction
         */
        initFlags(array)
        {
            let t, b;
            let u, v;
            let upLim = contLevels.length - 1;

            for (let i = ms; i < mf; i++) {
                for (let j = ns; j < nf; j++) {
                    let bound = bounds[i][j];

                    u = array[i][j];

                    if (j < (nf - 1)) {
                        v = array[i][j + 1];

                        //  Here we set the slope-sign for this horizontal segment.
                        //  We set it in terms of the X-direction vector which will intersect
                        //  this edge when the vector is going in the direction of increasing X. It
                        //  will have the opposite sign if the vector is going in the direction
                        //  of decreasing X
                        bound.CW0 = (v < u) ? COUNTERCLOCKWISE : CLOCKWISE;

                        if (v > u) {
                            t = upLim;
                            while (t > 0 && contLevels.get(t) > v) t--;

                            b = 0;
                            while (b <= t && contLevels.get(b) <= u) b++;
                        } else {
                            t = upLim;
                            while (t > 0 && contLevels.get(t) > u) t--;

                            b = 0;
                            while (b <= t && contLevels.get(b) <= v) b++;
                        }

                        if (t >= b) {
                            bound.top0 = t;
                            bound.bot0 = b;
                        }
                    }

                    if (i < (mf - 1)) {
                        v = array[i + 1][j];

                        // Now we set the slope-sign for this vertical segment.  We set
                        // it for the vector that will intersect this edge when the
                        // vector is going in the direction of increasing Y. It will
                        // have the opposite sign if the vector is moving in
                        // the direction of decreasing Y.

                        bound.CW1 = (v > u) ? COUNTERCLOCKWISE : CLOCKWISE;

                        if (v > u) {
                            t = upLim;
                            while (t > 0 && contLevels.get(t) > v) t--;

                            b = 0;
                            while (b <= t && contLevels.get(b) <= u) b++;
                        } else {
                            t = upLim;
                            while (t > 0 && contLevels.get(t) > u) t--;

                            b = 0;
                            while (b <= t && contLevels.get(b) <= v) b++;
                        }

                        if (t >= b) {
                            bound.top1 = t;
                            bound.bot1 = b;
                        }
                    }
                }
            }

        }
    }
}



