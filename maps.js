
// Create the script tag, set the appropriate attributes
var script = document.createElement('script');
script.src = 'https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&callback=initMap';
script.defer = true;

// Attach your callback function to the `window` object
window.initMap = function() {
  // JS API is loaded and available
};

// Append the 'script' element to 'head'
document.head.appendChild(script);

let map;

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: -34.397, lng: 150.644 },
    zoom: 8,
  });
}

/**
 * Firebase config block.
 */
var config = {
    apiKey: 'AIzaSyDX-tgWqPmTme8lqlFn2hIsqwxGL6FYPBY',
    authDomain: 'maps-docs-team.firebaseapp.com',
    databaseURL: 'https://maps-docs-team.firebaseio.com',
    projectId: 'maps-docs-team',
    storageBucket: 'maps-docs-team.appspot.com',
    messagingSenderId: '285779793579'
  };
  
  firebase.initializeApp(config);
  
  /**
   * Data object to be written to Firebase.
   */
  var data = {sender: null, timestamp: null, lat: null, lng: null};
  
  function makeInfoBox(controlDiv, map) {
    // Set CSS for the control border.
    var controlUI = document.createElement('div');
    controlUI.style.boxShadow = 'rgba(0, 0, 0, 0.298039) 0px 1px 4px -1px';
    controlUI.style.backgroundColor = '#fff';
    controlUI.style.border = '2px solid #fff';
    controlUI.style.borderRadius = '2px';
    controlUI.style.marginBottom = '22px';
    controlUI.style.marginTop = '10px';
    controlUI.style.textAlign = 'center';
    controlDiv.appendChild(controlUI);
  
    // Set CSS for the control interior.
    var controlText = document.createElement('div');
    controlText.style.color = 'rgb(25,25,25)';
    controlText.style.fontFamily = 'Roboto,Arial,sans-serif';
    controlText.style.fontSize = '100%';
    controlText.style.padding = '6px';
    controlText.textContent =
        'The map shows all clicks made in the last 10 minutes.';
    controlUI.appendChild(controlText);
  }
  
        /**
        * Starting point for running the program. Authenticates the user.
        * @param {function()} onAuthSuccess - Called when authentication succeeds.
        */
        function initAuthentication(onAuthSuccess) {
          firebase.auth().signInAnonymously().catch(function(error) {
            console.log(error.code + ', ' + error.message);
          }, {remember: 'sessionOnly'});
  
          firebase.auth().onAuthStateChanged(function(user) {
            if (user) {
              data.sender = user.uid;
              onAuthSuccess();
            } else {
              // User is signed out.
            }
          });
        }
  
        /**
         * Creates a map object with a click listener and a heatmap.
         */
        function initMap() {
          var map = new google.maps.Map(document.getElementById('map'), {
            center: {lat: 0, lng: 0},
            zoom: 3,
            styles: [{
              featureType: 'poi',
              stylers: [{ visibility: 'off' }]  // Turn off POI.
            },
            {
              featureType: 'transit.station',
              stylers: [{ visibility: 'off' }]  // Turn off bus, train stations etc.
            }],
            disableDoubleClickZoom: true,
            streetViewControl: false,
          });
  
          // Create the DIV to hold the control and call the makeInfoBox() constructor
          // passing in this DIV.
          var infoBoxDiv = document.createElement('div');
          makeInfoBox(infoBoxDiv, map);
          map.controls[google.maps.ControlPosition.TOP_CENTER].push(infoBoxDiv);
  
          // Listen for clicks and add the location of the click to firebase.
          map.addListener('click', function(e) {
            data.lat = e.latLng.lat();
            data.lng = e.latLng.lng();
            addToFirebase(data);
          });
  
          // Create a heatmap.
          var heatmap = new google.maps.visualization.HeatmapLayer({
            data: [],
            map: map,
            radius: 16
          });
  
          initAuthentication(initFirebase.bind(undefined, heatmap));
        }
  
        /**
         * Set up a Firebase with deletion on clicks older than expiryMs
         * @param {!google.maps.visualization.HeatmapLayer} heatmap The heatmap to
         */
        function initFirebase(heatmap) {
  
          // 10 minutes before current time.
          var startTime = new Date().getTime() - (60 * 10 * 1000);
  
          // Reference to the clicks in Firebase.
          var clicks = firebase.database().ref('clicks');
  
          // Listen for clicks and add them to the heatmap.
          clicks.orderByChild('timestamp').startAt(startTime).on('child_added',
            function(snapshot) {
              // Get that click from firebase.
              var newPosition = snapshot.val();
              var point = new google.maps.LatLng(newPosition.lat, newPosition.lng);
              var elapsedMs = Date.now() - newPosition.timestamp;
  
              // Add the point to the heatmap.
              heatmap.getData().push(point);
  
              // Request entries older than expiry time (10 minutes).
              var expiryMs = Math.max(60 * 10 * 1000 - elapsedMs, 0);
  
              // Set client timeout to remove the point after a certain time.
              window.setTimeout(function() {
                // Delete the old point from the database.
                snapshot.ref.remove();
              }, expiryMs);
            }
          );
  
          // Remove old data from the heatmap when a point is removed from firebase.
          clicks.on('child_removed', function(snapshot, prevChildKey) {
            var heatmapData = heatmap.getData();
            var i = 0;
            while (snapshot.val().lat != heatmapData.getAt(i).lat()
              || snapshot.val().lng != heatmapData.getAt(i).lng()) {
              i++;
            }
            heatmapData.removeAt(i);
          });
        }
  
        /**
         * Updates the last_message/ path with the current timestamp.
         * @param {function(Date)} addClick After the last message timestamp has been updated,
         *     this function is called with the current timestamp to add the
         *     click to the firebase.
         */
        function getTimestamp(addClick) {
          // Reference to location for saving the last click time.
          var ref = firebase.database().ref('last_message/' + data.sender);
  
          ref.onDisconnect().remove();  // Delete reference from firebase on disconnect.
  
          // Set value to timestamp.
          ref.set(firebase.database.ServerValue.TIMESTAMP, function(err) {
            if (err) {  // Write to last message was unsuccessful.
              console.log(err);
            } else {  // Write to last message was successful.
              ref.once('value', function(snap) {
                addClick(snap.val());  // Add click with same timestamp.
              }, function(err) {
                console.warn(err);
              });
            }
          });
        }
  
        /**
         * Adds a click to firebase.
         * @param {Object} data The data to be added to firebase.
         *     It contains the lat, lng, sender and timestamp.
         */
        function addToFirebase(data) {
          getTimestamp(function(timestamp) {
            // Add the new timestamp to the record data.
            data.timestamp = timestamp;
            var ref = firebase.database().ref('clicks').push(data, function(err) {
              if (err) {  // Data was not written to firebase.
                console.warn(err);
              }
            });
          });
        }

    defer src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&libraries=visualization&callback=initMap"