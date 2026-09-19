// 0x65c7e0 RandomRanged size=AD

int __thiscall sub_65C7E0(_DWORD *this, int a2, int a3)
{
  int result; // eax
  int v5; // ecx
  int v6; // ebx
  int v7; // edi
  bool v8; // zf
  int v9; // ecx
  int v10; // eax
  int i; // ebp
  int v12; // eax
  int v13; // eax
  int v14; // esi
  int v15; // ecx

  result = a2;
  v5 = a3;
  v6 = a2;
  if ( a2 != a3 )
  {
    if ( a2 > a3 )
    {
      v6 = a3;
      v5 = a2;
    }
    v7 = v5 - v6;
    v8 = v5 - v6 >= 0;
    v9 = 31;
    if ( v8 )
    {
      do
      {
        if ( v9 <= 0 )
          break;
        --v9;
      }
      while ( ((1 << v9) & v7) == 0 );
    }
    v10 = v7 + 1;
    for ( i = ~(-1 << (v9 + 1)); v10 > v7; v10 = i & v12 )
    {
      if ( *(_BYTE *)this != 0 )
      {
        v12 = 0;
      }
      else
      {
        *(this + *(this + 1) + 3) ^= *(this + *(this + 2) + 3);
        v13 = *(this + 1);
        v14 = *(this + v13++ + 3);
        v15 = *(this + 2) + 1;
        *(this + 1) = v13;
        *(this + 2) = v15;
        if ( v13 >= 250 )
          *(this + 1) = 0;
        if ( v15 >= 250 )
          *(this + 2) = 0;
        v12 = v14;
      }
    }
    return v6 + v10;
  }
  return result;
}
