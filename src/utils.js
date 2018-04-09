export function kvsToObject(kvs) {
    let result = {};
    for (let kv of kvs) {
        result[kv.key] = kv.value;
    }
    return result;
}
