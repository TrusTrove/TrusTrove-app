import re
import os

def rewrite_sme():
    with open("apps/web/components/shared/SmeCalculator.tsx", "r") as f:
        content = f.read()
    
    # Imports
    content = content.replace('import React, { useState } from "react";', 'import React, { useState, useMemo, useCallback } from "react";')
    
    # Memoize values
    content = content.replace(
        'const discountPaid = (faceValue * smeDiscountRate) / 100;',
        'const discountPaid = useMemo(() => (faceValue * smeDiscountRate) / 100, [faceValue, smeDiscountRate]);'
    )
    content = content.replace(
        'const fundedAmount = faceValue - discountPaid;',
        'const fundedAmount = useMemo(() => faceValue - discountPaid, [faceValue, discountPaid]);'
    )
    
    # Memoize handlers
    content = content.replace(
        'const [daysToMaturity, setDaysToMaturity] = useState<number>(30);\n',
        'const [daysToMaturity, setDaysToMaturity] = useState<number>(30);\n\n  const handleFaceValueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setFaceValue(parseInt(e.target.value)), []);\n  const handleDiscountRateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setSmeDiscountRate(parseFloat(e.target.value)), []);\n  const handleMaturityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setDaysToMaturity(parseInt(e.target.value)), []);\n'
    )
    
    content = content.replace('onChange={(e) => setFaceValue(parseInt(e.target.value))}', 'onChange={handleFaceValueChange}')
    content = content.replace('onChange={(e) => setSmeDiscountRate(parseFloat(e.target.value))}', 'onChange={handleDiscountRateChange}')
    content = content.replace('onChange={(e) => setDaysToMaturity(parseInt(e.target.value))}', 'onChange={handleMaturityChange}')
    
    with open("apps/web/components/shared/SmeCalculator.tsx", "w") as f:
        f.write(content)

def rewrite_lp():
    with open("apps/web/components/shared/LpCalculator.tsx", "r") as f:
        content = f.read()
        
    content = content.replace('import React, { useState } from "react";', 'import React, { useState, useMemo, useCallback } from "react";')
    
    content = content.replace(
        'const lpProjectedApy =\n    (lpUtilization / 100) * (lpAvgDiscount / 100) * (365 / lpAvgMaturity) * 100;',
        'const lpProjectedApy = useMemo(() => (lpUtilization / 100) * (lpAvgDiscount / 100) * (365 / lpAvgMaturity) * 100, [lpUtilization, lpAvgDiscount, lpAvgMaturity]);'
    )
    content = content.replace(
        'const lpAnnualEarnings = lpDeposit * (lpProjectedApy / 100);',
        'const lpAnnualEarnings = useMemo(() => lpDeposit * (lpProjectedApy / 100), [lpDeposit, lpProjectedApy]);'
    )
    
    content = content.replace(
        'const [lpAvgMaturity, setLpAvgMaturity] = useState<number>(60);\n',
        'const [lpAvgMaturity, setLpAvgMaturity] = useState<number>(60);\n\n  const handleLpDepositChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setLpDeposit(parseInt(e.target.value)), []);\n  const handleLpUtilizationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setLpUtilization(parseInt(e.target.value)), []);\n  const handleLpAvgDiscountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setLpAvgDiscount(parseFloat(e.target.value)), []);\n  const handleLpAvgMaturityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setLpAvgMaturity(parseInt(e.target.value)), []);\n'
    )
    
    content = content.replace('onChange={(e) => setLpDeposit(parseInt(e.target.value))}', 'onChange={handleLpDepositChange}')
    content = content.replace('onChange={(e) => setLpUtilization(parseInt(e.target.value))}', 'onChange={handleLpUtilizationChange}')
    content = content.replace('onChange={(e) => setLpAvgDiscount(parseFloat(e.target.value))}', 'onChange={handleLpAvgDiscountChange}')
    content = content.replace('onChange={(e) => setLpAvgMaturity(parseInt(e.target.value))}', 'onChange={handleLpAvgMaturityChange}')

    with open("apps/web/components/shared/LpCalculator.tsx", "w") as f:
        f.write(content)

rewrite_sme()
rewrite_lp()
