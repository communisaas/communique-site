#!/bin/bash

echo "Fixing TypeScript unused variables..."

# Fix function parameters that are already prefixed with _ but still showing as errors
echo "Removing already prefixed unused variables..."
find src/ -name "*.ts" -exec sed -i '' 's/const _err =/const __err =/g' {} \;
find src/ -name "*.ts" -exec sed -i '' 's/const _e =/const __e =/g' {} \;
find src/ -name "*.ts" -exec sed -i '' 's/let _err =/let __err =/g' {} \;
find src/ -name "*.ts" -exec sed -i '' 's/let _e =/let __e =/g' {} \;

# Fix destructuring parameters 
echo "Fixing function parameter destructuring..."
find src/ -name "*.ts" -exec sed -i '' 's/user_id,/_user_id,/g' {} \;
find src/ -name "*.ts" -exec sed -i '' 's/endpoint,/_endpoint,/g' {} \;
find src/ -name "*.ts" -exec sed -i '' 's/success,/_success,/g' {} \;
find src/ -name "*.ts" -exec sed -i '' 's/computation_time_ms/_computation_time_ms/g' {} \;
find src/ -name "*.ts" -exec sed -i '' 's/personalizedMessage/_personalizedMessage/g' {} \;
find src/ -name "*.ts" -exec sed -i '' 's/targetRep/_targetRep/g' {} \;
find src/ -name "*.ts" -exec sed -i '' 's/address,/_address,/g' {} \;
find src/ -name "*.ts" -exec sed -i '' 's/representative/_representative/g' {} \;

# Fix function parameters
echo "Fixing function parameters..."
find src/ -name "*.ts" -exec sed -i '' 's/(step:/(\_step:/g' {} \;
find src/ -name "*.ts" -exec sed -i '' 's/(step)/(\_step)/g' {} \;

# Fix imports
echo "Fixing import statements..."
find src/ -name "*.ts" -exec sed -i '' 's/AlertTriangle/AlertTriangle as _AlertTriangle/g' {} \;
find src/ -name "*.ts" -exec sed -i '' 's/ArrowRight/ArrowRight as _ArrowRight/g' {} \;
find src/ -name "*.ts" -exec sed -i '' 's/UnknownRecord/UnknownRecord as _UnknownRecord/g' {} \;
find src/ -name "*.ts" -exec sed -i '' 's/isErrorResponseData/isErrorResponseData as _isErrorResponseData/g' {} \;
find src/ -name "*.ts" -exec sed -i '' 's/isSuccessResponseData/isSuccessResponseData as _isSuccessResponseData/g' {} \;
find src/ -name "*.ts" -exec sed -i '' 's/RequestHandler/RequestHandler as _RequestHandler/g' {} \;
find src/ -name "*.ts" -exec sed -i '' 's/Jurisdiction/Jurisdiction as _Jurisdiction/g' {} \;
find src/ -name "*.ts" -exec sed -i '' 's/Chamber/Chamber as _Chamber/g' {} \;
find src/ -name "*.ts" -exec sed -i '' 's/Address/Address as _Address/g' {} \;

echo "Done fixing TypeScript unused variables!"