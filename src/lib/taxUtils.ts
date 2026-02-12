/**
 * 캐디 종합소득세 계산 유틸리티
 * 2024-2025년 기준 단순경비율 및 소득세율 반영
 */

export interface TaxResult {
    revenue: number;          // 총 수입
    expenses: number;         // 필요 경비 (단순경비율 적용)
    incomeAmount: number;     // 종합소득금액 (수입 - 경비)
    deduction: number;        // 소득공제 (기본공제 등)
    taxBase: number;          // 과세표준
    calculatedTax: number;    // 산출세액 (종합소득세)
    taxCredit: number;        // 세액공제 (표준세액공제 등)
    finalTax: number;         // 결정세액
    localTax: number;         // 지방소득세 (10%)
    totalTax: number;         // 총 납부세액
}

export const calculateCaddyTax = (revenue: number, personalDeduction: number = 1500000): TaxResult => {
    // 1. 필요경비 계산 (단순경비율 적용)
    // 업종코드 940914 (캐디): 4천만원 이하 68.2%, 초과분 55.5%
    let expenses = 0;
    if (revenue <= 40000000) {
        expenses = revenue * 0.682;
    } else {
        expenses = (40000000 * 0.682) + ((revenue - 40000000) * 0.555);
    }

    // 2. 종합소득금액
    const incomeAmount = Math.max(0, revenue - expenses);

    // 3. 과세표준 (소득금액 - 소득공제)
    // 기본적으로 본인공제 150만원 적용
    const deduction = personalDeduction;
    const taxBase = Math.max(0, incomeAmount - deduction);

    // 4. 산출세액 계산 (2024-2025 세율)
    let calculatedTax = 0;
    if (taxBase <= 14000000) {
        calculatedTax = taxBase * 0.06;
    } else if (taxBase <= 50000000) {
        calculatedTax = (taxBase * 0.15) - 1260000;
    } else if (taxBase <= 88000000) {
        calculatedTax = (taxBase * 0.24) - 5760000;
    } else if (taxBase <= 150000000) {
        calculatedTax = (taxBase * 0.35) - 15440000;
    } else {
        // 그 이상의 구간은 캐디 수입 특성상 거의 발생하지 않으므로 여기까지 처리
        calculatedTax = (taxBase * 0.38) - 19940000;
    }

    // 5. 세액공제 (표준세액공제 등 간단히 적용)
    // 단순경비율 대상자는 표준세액공제 7만원 적용 가능
    const taxCredit = taxBase > 0 ? 70000 : 0;
    const finalTax = Math.max(0, calculatedTax - taxCredit);

    // 6. 지방소득세 (10%)
    const localTax = Math.floor(finalTax * 0.1);

    // 7. 총 납부세액
    const totalTax = finalTax + localTax;

    return {
        revenue,
        expenses: Math.floor(expenses),
        incomeAmount: Math.floor(incomeAmount),
        deduction,
        taxBase: Math.floor(taxBase),
        calculatedTax: Math.floor(calculatedTax),
        taxCredit,
        finalTax: Math.floor(finalTax),
        localTax,
        totalTax: Math.floor(totalTax)
    };
};
