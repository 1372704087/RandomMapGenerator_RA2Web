// 0x5ad870 Shore_HeapReg size=B8

void __thiscall sub_5AD870(int *this, int a2)
{
  int v2; // esi
  int v3; // edx
  int v4; // edi
  int v5; // eax
  int v6; // ebp
  int v7; // edi

  v2 = a2;
  v3 = 2 * a2;
  v4 = 2 * a2 + 1;
  if ( 2 * a2 > *this
    || *(float *)(*(_DWORD *)(*(this + 2) + 4 * a2) + 4) <= (double)*(float *)(*(_DWORD *)(*(this + 2) + 8 * a2) + 4) )
  {
    v3 = a2;
  }
  if ( v4 <= *this
    && *(float *)(*(_DWORD *)(*(this + 2) + 4 * v3) + 4) > (double)*(float *)(*(_DWORD *)(*(this + 2) + 4 * v4) + 4) )
  {
    v3 = 2 * a2 + 1;
  }
  if ( v3 != a2 )
  {
    do
    {
      v5 = *(this + 2);
      v6 = 2 * v3 + 1;
      v7 = *(_DWORD *)(v5 + 4 * v2);
      *(_DWORD *)(v5 + 4 * v2) = *(_DWORD *)(v5 + 4 * v3);
      v2 = v3;
      *(_DWORD *)(*(this + 2) + 4 * v3) = v7;
      if ( 2 * v3 <= *this
        && *(float *)(*(_DWORD *)(*(this + 2) + 4 * v3) + 4) > (double)*(float *)(*(_DWORD *)(*(this + 2) + 8 * v3) + 4) )
      {
        v3 *= 2;
      }
      if ( v6 <= *this
        && *(float *)(*(_DWORD *)(*(this + 2) + 4 * v3) + 4) > (double)*(float *)(*(_DWORD *)(*(this + 2) + 4 * v6) + 4) )
      {
        v3 = v6;
      }
    }
    while ( v3 != v2 );
  }
}
