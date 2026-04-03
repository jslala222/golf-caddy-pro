/**
 * 캐디 순번 계산 로직 (종이 문서 기반)
 */

interface CaddyScheduleResult {
    sequence: number; // 실제 순번
    time: string;     // 티오프 시간
    course: string;   // 예상 코스
}

/**
 * 7분 간격 고정 로직을 사용하여 시간을 계산합니다.
 */
export function calculateTime(startTime: string, sequence: number): string {
    const [h, m] = startTime.split(':').map(Number);
    const totalMinutes = h * 60 + m + (sequence - 1) * 7;

    const finalH = Math.floor(totalMinutes / 60) % 24;
    const finalM = totalMinutes % 60;

    return `${String(finalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`;
}

/**
 * 특정 날짜의 전체 명단, 휴무자, 예비자 데이터를 기반으로 
 * 특정 캐디의 오늘 순번과 시간을 계산합니다.
 */
export function findCaddyTurn(
    caddyName: string,
    fullCaddyList: string[], // 전체 캐디 명단 (순번순)
    todaysHolidays: string[], // 오늘 휴무자 명단
    todaysReserves: string[], // 오늘 예비자 명단
    startTime: string = "06:00"
): CaddyScheduleResult | null {

    // 1. 오늘 실제로 일하는 사람 명단 추출
    // 원본 명단에서 휴무자 제외
    const activeList = fullCaddyList.filter(name => !todaysHolidays.includes(name));

    // 2. 예비자 추가 (보통 예비자는 맨 뒤에 붙거나 특정 규칙이 있지만, 여기서는 맨 뒤로 가정)
    // TODO: 예비자의 삽입 위치에 대한 대표님의 추가 확인이 필요할 수 있음
    const finalMemberList = [...activeList, ...todaysReserves];

    // 3. 내 이름 찾기
    const myIndex = finalMemberList.indexOf(caddyName);

    if (myIndex === -1) return null;

    const mySequence = myIndex + 1;
    const myTime = calculateTime(startTime, mySequence);

    // 4. 코스 추정 (84팀 기준, 동/서/남 3개 코스 순환 가정)
    const courses = ["동", "서", "남"];
    const courseIdx = (mySequence - 1) % 3;

    return {
        sequence: mySequence,
        time: myTime,
        course: courses[courseIdx]
    };
}
