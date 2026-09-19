// 0x477be0 VecInit size=4A

_DWORD *__thiscall sub_477BE0(_DWORD *this, int a2, int a3)
{
  *(this + 1) = 0;
  *(this + 2) = a2;
  *((_BYTE *)this + 12) = 1;
  *((_BYTE *)this + 13) = 0;
  *this = &VectorClass<int>::`vftable';
  if ( a2 != 0 )
  {
    if ( a3 != 0 )
    {
      *(this + 1) = a3;
      return this;
    }
    *(this + 1) = operator new(4 * a2);
    *((_BYTE *)this + 13) = 1;
  }
  return this;
}
