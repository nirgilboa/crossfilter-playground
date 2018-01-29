#!/bin/bash

tmpfile=$(mktemp /tmp/tmp.XXXX.css)
cat > $tmpfile
npx css-flip $tmpfile
rm $tmpfile


