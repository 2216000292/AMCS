const kdtree = require('static-kdtree');
const tf = require('@tensorflow/tfjs');

// Helper function to calculate distance between two 3D points
export function distance3D(point1, point2) {
  return Math.sqrt(
    Math.pow(point1[0] - point2[0], 2) +
    Math.pow(point1[1] - point2[1], 2) +
    Math.pow(point1[2] - point2[2], 2)
  );
}

function lineSegmentDistance(line1, line2, type){
  let fun;
  
  if (type == "shortest"){
    fun = distanceShortest;
  }else if (type == "longest"){
    fun = distanceLongest;
  }else {
    fun = distanceHaustoff;
  }

  return fun(line1, line2);
  
}

function distancePointToLineSegment(point, lineStart, lineEnd) {
  // calculate vector between line endpoints
  var lineVector = [lineEnd[0] - lineStart[0], lineEnd[1] - lineStart[1], lineEnd[2] - lineStart[2]];
  
  // calculate vector between line start and point
  var pointVector = [point[0] - lineStart[0], point[1] - lineStart[1], point[2] - lineStart[2]];
  
  // calculate projection of point vector onto line vector
  var dotProduct = pointVector[0] * lineVector[0] + pointVector[1] * lineVector[1] + pointVector[2] * lineVector[2];
  var lineLengthSquared = lineVector[0] * lineVector[0] + lineVector[1] * lineVector[1] + lineVector[2] * lineVector[2];
  var lineScalar = dotProduct / lineLengthSquared;
  
  // calculate closest point on line segment to point
  var closestPoint;
  if (lineScalar < 0) {
    closestPoint = lineStart;
  } else if (lineScalar > 1) {
    closestPoint = lineEnd;
  } else {
    closestPoint = [
      lineStart[0] + lineScalar * lineVector[0],
      lineStart[1] + lineScalar * lineVector[1],
      lineStart[2] + lineScalar * lineVector[2]
    ];
  }
  
  // calculate distance between point and closest point
  var distanceVector = [point[0] - closestPoint[0], point[1] - closestPoint[1], point[2] - closestPoint[2]];
  var distance = Math.sqrt(distanceVector[0] * distanceVector[0] + distanceVector[1] * distanceVector[1] + distanceVector[2] * distanceVector[2]);
  
  return distance;
}


function distanceHaustoff(line1, line2, samples = 10) {
  //console.log("HERE");
  function euclideanDistance(pointA, pointB) {
    return Math.sqrt(
      Math.pow(pointA[0] - pointB[0], 2) +
      Math.pow(pointA[1] - pointB[1], 2) +
      Math.pow(pointA[2] - pointB[2], 2)
    );
  }

  function nearestDistance(point, set) {
    let minDistance = Infinity;

    for (const p of set) {
      const distance = euclideanDistance(point, p);
      if (distance < minDistance) {
        minDistance = distance;
      }
    }

    return minDistance;
  }

  function maxDistance(setA, setB) {
    let maxDistance = 0;

    for (const point of setA) {
      const distance = nearestDistance(point, setB);
      if (distance > maxDistance) {
        maxDistance = distance;
      }
    }

    return maxDistance;
  }

  function samplePointsOnSegment(segment, samples) {
    const [p0, p1] = segment;
    const points = [];

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const x = p0[0] + t * (p1[0] - p0[0]);
      const y = p0[1] + t * (p1[1] - p0[1]);
      const z = p0[2] + t * (p1[2] - p0[2]);

      points.push([x, y, z]);
    }

    return points;
  }

  const setA = samplePointsOnSegment(line1, samples);
  const setB = samplePointsOnSegment(line2, samples);

  return Math.max(maxDistance(setA, setB), maxDistance(setB, setA));
}


function distanceLongest(line1, line2) {
  const p0 = line1[0];
  const p1 = line1[1];
  const q0 = line2[0];
  const q1 = line2[1];

  const distances = [
    distance3D(p0, q0),
    distance3D(p0, q1),
    distance3D(p1, q0),
    distance3D(p1, q1),
  ];

  return Math.max(...distances);
}


// Helper function to calculate true distance between two 3D line segments
function distanceShortest(line1, line2) {
    const p0 = line1[0];
    const p1 = line1[1];
    const q0 = line2[0];
    const q1 = line2[1];
  
    const u = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const v = [q1[0] - q0[0], q1[1] - q0[1], q1[2] - q0[2]];
    const w = [p0[0] - q0[0], p0[1] - q0[1], p0[2] - q0[2]];
  
    const a = dotProduct(u, u);
    const b = dotProduct(u, v);
    const c = dotProduct(v, v);
    const d = dotProduct(u, w);
    const e = dotProduct(v, w);
    const D = a * c - b * b;
  
    let sc, sN, sD = D;
    let tc, tN, tD = D;
  
    if (D < 1e-8) {
      sN = 0;
      sD = 1;
      tN = e;
      tD = c;
    } else {
      sN = (b * e - c * d);
      tN = (a * e - b * d);
      if (sN < 0) {
        sN = 0;
        tN = e;
        tD = c;
      } else if (sN > sD) {
        sN = sD;
        tN = e + b;
        tD = c;
      }
    }
  
    if (tN < 0) {
      tN = 0;
      if (-d < 0) {
        sN = 0;
      } else if (-d > a) {
        sN = sD;
      } else {
        sN = -d;
        sD = a;
      }
    } else if (tN > tD) {
      tN = tD;
      if (-d + b < 0) {
        sN = 0;
      } else if (-d + b > a) {
        sN = sD;
      } else {
        sN = -d + b;
        sD = a;
      }
    }
  
    sc = Math.abs(sN) < 1e-8 ? 0 : sN / sD;
    tc = Math.abs(tN) < 1e-8 ? 0 : tN / tD;
  
    const dp = [
      w[0] + (sc * u[0]) - (tc * v[0]),
      w[1] + (sc * u[1]) - (tc * v[1]),
      w[2] + (sc * u[2]) - (tc * v[2])
    ];
  
    return Math.sqrt(dotProduct(dp, dp));
  }
  
  function dotProduct(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }
  

// Function to create a KD-tree from an array of line segments
export function createLineSegmentKDTree(lineSegments) {
    const points = [];
    for (const segment of lineSegments) {
      points.push(segment[0]); // Start point
      points.push(segment[1]); // End point
    }
    //console.log("kdtreepts: ", points);
    const tree =  kdtree(points);
    tree.orgPts = points;
    return tree;
  }
  
  // Function to find K nearest neighbors for a query line segment, given a KD-tree of line segment end points
  export function findKNearestNeighbors(tree, querySegment, lineSegments, K, distMetric) {

    // Calculate the midpoint of the query line segment
    const midpoint = [
      (querySegment[0][0] + querySegment[1][0]) / 2,
      (querySegment[0][1] + querySegment[1][1]) / 2,
      (querySegment[0][2] + querySegment[1][2]) / 2,
    ];
  
    // Find K*2 nearest points around the query segment's midpoint
    const nearestPoints = tree.knn(midpoint, K * 2);
    //console.log(tree.points)
    //console.log("numk:", nearestPoints.length);
    // Find the max radius R from these neighbors
    let maxRadius = 0;
    for (const idx of nearestPoints) {
      const point = tree.orgPts[idx];
      const dist = distance3D(midpoint, point);
      //console.log(midpoint, point, dist);
      if (dist > maxRadius) {
        maxRadius = dist;
      }
    }
  
    // Compute the radius for the extended search (R + 2 * C)
    const C = distance3D(querySegment[0], querySegment[1]);
    const searchRadius = maxRadius + 2 * C;
    //console.log("maxR: ", maxRadius, searchRadius,C);
    // Find all points within the search radius
    const pointsWithinRadius = [];
    tree.rnn(midpoint, searchRadius, function(idx) {
      pointsWithinRadius.push(idx);
    });
    //console.log("NUM:",pointsWithinRadius.length);
    // Compute the true distance between the query segment and each segment within that radius
    const distances = [];
    const uniqueSegmentIndices = new Set();
    for (const idx of pointsWithinRadius) {

      const segmentIndex = Math.floor(idx / 2);
      if (!uniqueSegmentIndices.has(segmentIndex)) {
        uniqueSegmentIndices.add(segmentIndex);
        const segment = lineSegments[segmentIndex];
        const trueDistance = lineSegmentDistance(querySegment, segment,distMetric);
        distances.push({ index: segmentIndex, distance: trueDistance });
      }
    }
    //console.log("maxR: ", maxRadius);
    // Sort the distances and find K nearest segments
    distances.sort((a, b) => a.distance - b.distance);
    //const kNearestNeighbors = distances.slice(0, K).map((d) => lineSegments[d.index]);
    const kNearestNeighborIndices = distances.slice(0, K).map((d) => d.index);

  
    return kNearestNeighborIndices;
  }
  
// Function to find  neighbors within R for a query line segment, given a KD-tree of line segment end points
export function findRBN(tree, querySegment, lineSegments, R,distMetric) {

  // Calculate the midpoint of the query line segment
  const midpoint = [
    (querySegment[0][0] + querySegment[1][0]) / 2,
    (querySegment[0][1] + querySegment[1][1]) / 2,
    (querySegment[0][2] + querySegment[1][2]) / 2,
  ];

  const C = distance3D(querySegment[0], querySegment[1]);
  const searchRadius = R + 2 * C;
  const pointsWithinRadius = [];
  tree.rnn(midpoint, searchRadius, function(idx) {
    pointsWithinRadius.push(idx);
  });
  //console.log("NUM:",pointsWithinRadius.length);
  // Compute the true distance between the query segment and each segment within that radius
  const distances = [];
  const uniqueSegmentIndices = new Set();
  for (const idx of pointsWithinRadius) {

    const segmentIndex = Math.floor(idx / 2);
    if (!uniqueSegmentIndices.has(segmentIndex)) {
      uniqueSegmentIndices.add(segmentIndex);
      const segment = lineSegments[segmentIndex];
      const trueDistance = lineSegmentDistance(querySegment, segment,distMetric);
      distances.push({ index: segmentIndex, distance: trueDistance });
    }
  }
  //console.log("maxR: ", maxRadius);
  // Sort the distances and find K nearest segments
  
  //distances.filter((seg) => seg.distance <= R);
  
  //const kNearestNeighbors = distances.slice(0, K).map((d) => lineSegments[d.index]);
  //const kNearestNeighborIndices = distances.slice(0, K).map((d) => d.index);


  const res =  distances.filter((seg) => seg.distance <= R).map((seg) => seg.index);
  //console.log(res);
  return res;
}

export function processSegments(segments){
const lineSegments = [];
segments.forEach(seg => {
lineSegments.push([seg.startPoint, seg.endPoint]);
});
return lineSegments;
}

function generateRandomLineSegments(numSegments, C, boxSize) {
    const lineSegments = [];
  
    for (let i = 0; i < numSegments; i++) {
      // Generate a random starting point within the bounding box
      const startPoint = [
        Math.random() * boxSize,
        Math.random() * boxSize,
        Math.random() * boxSize,
      ];
  
      // Generate a random unit direction vector
      const direction = [
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
      ];
      const directionLength = Math.sqrt(direction[0] ** 2 + direction[1] ** 2 + direction[2] ** 2);
      const unitDirection = direction.map(d => d / directionLength);
  
      // Calculate the end point using the starting point, direction, and fixed length
      const endPoint = [
        startPoint[0] + unitDirection[0] * C,
        startPoint[1] + unitDirection[1] * C,
        startPoint[2] + unitDirection[2] * C,
      ];
  
      // Add the line segment to the list
      lineSegments.push([startPoint, endPoint]);
    }
  
    return lineSegments;
  }

  function measureExecutionTime(func) {
    const startTime = performance.now(); // start the timer
  
    // call the function
    func();
  
    const endTime = performance.now(); // stop the timer
    const executionTime = endTime - startTime; // calculate the time difference
  
    console.log(`Execution time: ${executionTime} milliseconds`);
  }
  
  function unitTest(){
    const numSegments = 200000;
    const fixedLength = 10;
    const boxSize = 100;
    const K = 5;
    
    let lineSegments = generateRandomLineSegments(numSegments, fixedLength, boxSize);

    
    let tree;

    console.log("Create")
    measureExecutionTime(()=>{
      tree = createLineSegmentKDTree(lineSegments);
    });
    
    console.log("KNN")
    measureExecutionTime(()=>{
      let res = findKNearestNeighbors(tree, lineSegments[0], lineSegments, K);
      console.log(res);
    ``});
    

  // Dispose the tree when you are done with it
  tree.dispose();
}

export function computeBounds(arr) {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (let ii=0; ii < arr.length; ii++)
  for (let i = 0; i < 2; i++) {
    const [x, y, z] = arr[ii][i];
    if (x < minX) {
      minX = x;
    }
    if (y < minY) {
      minY = y;
    }
    if (z < minZ) {
      minZ = z;
    }
    if (x > maxX) {
      maxX = x;
    }
    if (y > maxY) {
      maxY = y;
    }
    if (z > maxZ) {
      maxZ = z;
    }
  }

  return {
    minX,
    minY,
    minZ,
    maxX,
    maxY,
    maxZ,
  };
}

export function computeDiagonalLength(bounds) {
  const { minX, minY, minZ, maxX, maxY, maxZ } = bounds;
  const dx = maxX - minX;
  const dy = maxY - minY;
  const dz = maxZ - minZ;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}