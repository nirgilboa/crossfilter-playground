export function kvsToObject(kvs) {
    let result = {};
    for (let kv of kvs) {
        result[kv.key] = kv.value;
    }
    return result;
}

export function formatDate(dt) {
    return `${dt.getDate()}/${1+dt.getMonth()}/${dt.getFullYear()}`;
}