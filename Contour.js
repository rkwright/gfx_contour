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

class Contour  {

    //--- constants ---
    REVISION = '0.1.0';

    //--- class methods ---
    constructor () {
    }

    SetUp ( array ) {

        console.log("Setting up Contour. Array size: " + array.length + " subLen: " +  array[0].length);
    }

    ThreadContours ( array,  contLevel ) {

        console.log("Threading Contour. Array size: " + array.length +
                            "  contour level: " + contLevel.toFixed(1));

    }
}

