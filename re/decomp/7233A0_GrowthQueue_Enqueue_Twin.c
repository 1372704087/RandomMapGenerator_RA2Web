int __thiscall sub_7233A0(int **this)
{
  int v2; // ecx
  int *v3; // eax
  int i; // eax
  int result; // eax
  int j; // edi
  int v7; // ecx
  int v8; // eax
  _DWORD *v9; // ebp
  unsigned int v10; // ebx
  unsigned int v11; // edx
  unsigned int v12; // edi
  int v13; // ecx
  int v14; // ebx
  unsigned int v15; // eax
  float v16; // [esp+8h] [ebp-Ch]
  int v17; // [esp+Ch] [ebp-8h]
  unsigned int v18; // [esp+10h] [ebp-4h]

  v2 = 0;
  v3 = *(this + 68);
  *(this + 67) = nullptr;
  if ( *v3 >= 0 )
  {
    do
    {
      ++v2;
      *(_DWORD *)(v3[2] + 4 * v2 - 4) = 0;
    }
    while ( v2 <= *v3 );
  }
  *v3 = 0;
  for ( i = sub_42B1F0() - 1; i >= 0; *((_BYTE *)*(this + 69) + i + 1) = 0 )
    --i;
  sub_578350(&stru_87F7E8);
  result = sub_578290(&stru_87F7E8);
  for ( j = result; result != 0; j = result )
  {
    if ( (int *)sub_485010(j) == *(this + 38) && (unsigned __int8)sub_483620(j) != 0 )
    {
      v7 = j + 36;
      v17 = j + 36;
      (*(this + 70))[2 * (_DWORD)*(this + 67)] = *(_DWORD *)(j + 36);
      (*(this + 70))[2 * (_DWORD)*(this + 67) + 1] = 0;
      v8 = (int)*(this + 67);
      v9 = *(this + 68);
      v10 = (unsigned int)&(*(this + 70))[2 * v8];
      *(this + 67) = (int *)(v8 + 1);
      v11 = *v9 + 1;
      v16 = *(float *)(v10 + 4);
      v18 = v10;
      v12 = v11 >> 1;
      if ( v11 < v9[1] )
      {
        if ( v11 > 1 )
        {
          do
          {
            v13 = v9[2];
            v14 = *(_DWORD *)(v13 + 4 * v12);
            if ( *(float *)(v14 + 4) <= (double)v16 )
              break;
            *(_DWORD *)(v13 + 4 * v11) = v14;
            v11 = v12;
            v12 >>= 1;
          }
          while ( v11 > 1 );
          v7 = v17;
          v10 = v18;
        }
        *(_DWORD *)(v9[2] + 4 * v11) = v10;
        v15 = v9[3];
        ++*v9;
        if ( v10 > v15 )
          v9[3] = v10;
        if ( v10 < v9[4] )
          v9[4] = v10;
      }
      *((_BYTE *)*(this + 69) + sub_42B1C0(v7)) = 1;
    }
    result = sub_578290(&stru_87F7E8);
  }
  return result;
}
