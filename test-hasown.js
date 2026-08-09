const methodSurfaceAccess = {
  'ping': ['content-script'],
};
const method = 'toString';
console.log(method in methodSurfaceAccess);
console.log(Object.prototype.hasOwnProperty.call(methodSurfaceAccess, method));
