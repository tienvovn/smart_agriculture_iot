export function updatePumpLogic(farm) {

    let pump = farm.pump;
    let pumpTime = farm.pumpTime;

    // Nếu độ ẩm dưới 50%
    if (farm.humidity < 50 && !pump) {

        pump = true;

        pumpTime = 1800;

    }

    // Máy bơm đang chạy
    if (pump) {

        pumpTime--;

        if (pumpTime <= 0) {

            pump = false;

            pumpTime = 0;

        }

    }

    return {

        ...farm,

        pump,

        pumpTime,

    };

}