int __thiscall sub_56DA10(int *this, __int16 *a2, signed int a3, int a4)
{
  int *i; // ecx
  int v6; // eax
  __int64 v7; // rax
  int v9; // [esp+14h] [ebp-4h]
  int v10; // [esp+1Ch] [ebp+4h]

  v9 = *(this + 24);
  if ( a4 >= v9 )
    return -1;
  for ( i = (int *)(16 * a4 + *(this + 21)); ; i += 4 )
  {
    if ( i[3] == 0 )
    {
      v6 = i[1];
      v10 = *i;
      if ( (__int16)*i != (__int16)v6 )
        break;
      LOWORD(v6) = a2[1];
      if ( (__int16)v6 >= SHIWORD(v10) && (__int16)v6 <= SHIWORD(v6) && (int)abs32(*a2 - (__int16)*i) <= a3 )
        return a4;
    }
LABEL_12:
    if ( ++a4 >= v9 )
      return -1;
  }
  if ( *a2 > (__int16)v6 )
    goto LABEL_12;
  if ( *a2 < (__int16)*i )
    goto LABEL_12;
  v7 = a2[1] - SHIWORD(v10);
  if ( (int)((HIDWORD(v7) ^ v7) - HIDWORD(v7)) > a3 )
    goto LABEL_12;
  return a4;
}
