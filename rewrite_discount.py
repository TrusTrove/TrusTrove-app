import re
import os

with open("apps/web/components/shared/DiscountCalculator.tsx", "r") as f:
    content = f.read()

content = content.replace('import React, { useState, useEffect, useRef } from "react";', 'import React, { useState, useEffect, useRef, useCallback } from "react";')

content = content.replace(
    'const [activeTab, setActiveTab] = useState<"sme" | "lp">("sme");\n',
    'const [activeTab, setActiveTab] = useState<"sme" | "lp">("sme");\n\n  const handleSetSme = useCallback(() => setActiveTab("sme"), []);\n  const handleSetLp = useCallback(() => setActiveTab("lp"), []);\n'
)

content = content.replace('onClick={() => setActiveTab("sme")}', 'onClick={handleSetSme}')
content = content.replace('onClick={() => setActiveTab("lp")}', 'onClick={handleSetLp}')

with open("apps/web/components/shared/DiscountCalculator.tsx", "w") as f:
    f.write(content)

