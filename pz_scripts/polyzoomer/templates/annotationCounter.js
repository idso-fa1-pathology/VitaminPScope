
function countAnnotationsByTypeAndColor() {
    fetch(annotationsPath)
    .then(response => response.text())
    .then(data => {
        let lines = data.trim().split('\n');
        let annotationSummary = {
            'Line': {},
            'Arrow': {},
            'Rectangle': {},
            'Ellipse': {},
            'Free Hand Drawing': {},
            'Text': {},
            'Dot': {}
        };

        lines.forEach(line => {
            let parts = line.split('],');
            if (parts.length >= 2) {
                let preCoordinatePart = parts[0].split(',');
                let postCoordinatePart = parts[1].split(',');

                if (preCoordinatePart.length >= 4 && postCoordinatePart.length >= 1) {
                    let isActive = preCoordinatePart[0].trim() === '1'; // Check if the annotation is active
                    let type = parseInt(preCoordinatePart[2].trim());
                    let color = postCoordinatePart[0].trim().toLowerCase();
                    let typeName = getTypeName(type);

                    if (isActive && typeName) {
                        if (!annotationSummary[typeName][color]) {
                            annotationSummary[typeName][color] = 0;
                        }
                        annotationSummary[typeName][color]++;
                    }
                }
            }
        });

        updateHTMLWithAnnotationSummary(annotationSummary);
    })
    .catch(error => console.error('Error fetching annotations:', error));
}


function getTypeName(type) {
    switch(type) {
        case 0: return 'Line';
        case 1: return 'Arrow';
        case 2: return 'Rectangle';
        case 3: return 'Ellipse';
        case 4: return 'Free Hand Drawing';
        case 5: return 'Text';
        case 6: return 'Dot';
        default: return null;
    }
}

function updateHTMLWithAnnotationSummary(annotationSummary) {
    let resultText = '';
    for (let type in annotationSummary) {
        resultText += `<strong>${type}</strong>:<br>`;
        for (let color in annotationSummary[type]) {
            resultText += `<span style="height: 15px; width: 15px; background-color: ${color}; border-radius: 50%; display: inline-block; margin-right: 5px;"></span> Total: ${annotationSummary[type][color]}<br>`;
        }
    }
    document.getElementById('annotationSummaryDisplay').innerHTML = resultText;
}

window.onload = function() {
    setInterval(countAnnotationsByTypeAndColor, 1000); // Call every 1000 milliseconds
    SyncThemAll();
};
